/**
 * Paper Trading Interactive Demo
 * Simora Landing Page - Full Trading Simulation
 * 
 * Complete paper trading engine with:
 * - Real balance tracking
 * - Position management
 * - Average entry calculations
 * - Realized & Unrealized PnL
 * - Proper buy/sell validation
 */

(function() {
  'use strict';

  // ============================================================
  // DEMO STATES
  // ============================================================
  
  const DEMO_STATES = {
    IDLE: 'idle',
    POSITION_OPEN: 'position_open',
    PARTIALLY_SOLD: 'partially_sold',
    POSITION_CLOSED: 'position_closed',
    RESETTING: 'resetting'
  };

  // ============================================================
  // CENTRALIZED DEMO STATE
  // ============================================================
  
  const demoState = {
    // Session state
    status: DEMO_STATES.IDLE,
    initialBalance: 5.0,
    balance: 5.0, // Available cash balance
    
    // Market data
    currentPrice: 16300, // Price per token (in market cap units, e.g., 16.3K = 16300)
    initialMarketCap: 16300,
    
    // Position tracking
    position: {
      token: 'SIMORA',
      tokenAmount: 0, // Total tokens bought
      remainingTokenAmount: 0, // Tokens still held
      investedSol: 0, // Total SOL invested
      remainingInvestedSol: 0, // Cost basis of remaining tokens
      averageEntryPrice: 0, // Average entry price per token
      entryMarketCap: 0 // Market cap at first entry
    },
    
    // PnL tracking
    unrealizedPnlSol: 0,
    unrealizedPnlPercent: 0,
    realizedPnlSol: 0,
    
    // Trade history
    totalBoughtSol: 0,
    totalSoldSol: 0,
    buyCount: 0,
    sellCount: 0,
    
    // Processing flag to prevent duplicate clicks
    isProcessing: false
  };

  // ============================================================
  // FORMATTING HELPERS
  // ============================================================
  
  function formatSol(value) {
    // Show actual value without unnecessary decimals
    // 0 → "0"
    // 0.1 → "0.1" 
    // 0.123 → "0.123"
    // 0.1234 → "0.123" (rounded to 3 decimals)
    
    if (Math.abs(value) < 0.0005) return '0';
    
    // Format to 3 decimals and remove trailing zeros
    let formatted = value.toFixed(3);
    
    // Prevent -0.000
    if (formatted === '-0.000') return '0';
    
    // Remove trailing zeros after decimal point
    // 0.100 → 0.1
    // 0.120 → 0.12
    // 0.123 → 0.123
    formatted = formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    
    return formatted;
  }
  
  function formatBalance(value) {
    return value.toFixed(2);
  }
  
  function formatMarketCap(value) {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  }
  
  function formatPercent(value) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  // ============================================================
  // CHART SIMULATION
  // ============================================================
  
  let chartAnimationId = null;
  let chartStartTime = null;
  let lastRenderTime = 0;
  const CHART_DURATION = 60000; // 60 seconds cycle
  const RENDER_THROTTLE = 200; // 200ms between renders (5 FPS for smoother, less jittery updates)
  
  // Aggressive price movements - demo will show strong gains up to 40%
  const priceScenario = [
    { time: 0, change: 0 },       // Entry
    { time: 5, change: -3 },      // Initial dip (shakeout)
    { time: 10, change: 2 },      // Quick recovery
    { time: 15, change: 8 },      // Strong move up
    { time: 20, change: 12 },     // Momentum building
    { time: 25, change: 18 },     // Aggressive pump
    { time: 30, change: 25 },     // Peak momentum
    { time: 35, change: 22 },     // Small pullback
    { time: 40, change: 30 },     // New high
    { time: 45, change: 35 },     // Continuing up
    { time: 50, change: 40 },     // Peak gains
    { time: 55, change: 38 },     // Slight consolidation
    { time: 60, change: 35 }      // End with strong gains
  ];

  function interpolatePrice(elapsed) {
    const seconds = (elapsed / 1000) % 60;
    
    // Find surrounding keyframes
    let before = priceScenario[0];
    let after = priceScenario[priceScenario.length - 1];
    
    for (let i = 0; i < priceScenario.length - 1; i++) {
      if (seconds >= priceScenario[i].time && seconds <= priceScenario[i + 1].time) {
        before = priceScenario[i];
        after = priceScenario[i + 1];
        break;
      }
    }
    
    // Smooth interpolation with easing
    const progress = (seconds - before.time) / (after.time - before.time);
    const easedProgress = progress * progress * (3 - 2 * progress); // Smoothstep easing
    const changePercent = before.change + (after.change - before.change) * easedProgress;
    
    // Small random noise for natural movement
    const noise = (Math.random() - 0.5) * 0.3;
    
    const entryPrice = demoState.position.averageEntryPrice || demoState.initialMarketCap;
    return entryPrice * (1 + (changePercent + noise) / 100);
  }

  function updateChartPrice() {
    if (demoState.status === DEMO_STATES.IDLE || demoState.status === DEMO_STATES.RESETTING) {
      return;
    }
    
    if (!chartStartTime) {
      chartStartTime = Date.now();
    }
    
    const now = Date.now();
    const elapsed = now - chartStartTime;
    
    // Update price
    demoState.currentPrice = interpolatePrice(elapsed);
    
    // Throttle rendering to 200ms (reduce jitter)
    if (now - lastRenderTime >= RENDER_THROTTLE) {
      renderDemoState();
      lastRenderTime = now;
    }
    
    chartAnimationId = requestAnimationFrame(updateChartPrice);
  }

  function startChartSimulation() {
    stopChartSimulation();
    chartStartTime = Date.now();
    lastRenderTime = 0; // Reset throttle
    chartAnimationId = requestAnimationFrame(updateChartPrice);
  }

  function stopChartSimulation() {
    if (chartAnimationId) {
      cancelAnimationFrame(chartAnimationId);
      chartAnimationId = null;
    }
    chartStartTime = null;
    lastRenderTime = 0;
  }

  // ============================================================
  // CALCULATIONS
  // ============================================================
  
  function updateDemoCalculations() {
    // Calculate current position value
    const currentPositionValue = demoState.position.remainingTokenAmount * demoState.currentPrice;
    
    // Calculate cost basis for remaining position
    const currentCostBasis = demoState.position.remainingInvestedSol;
    
    // Calculate unrealized PnL
    demoState.unrealizedPnlSol = currentPositionValue - currentCostBasis;
    
    // Calculate unrealized PnL percentage
    demoState.unrealizedPnlPercent = currentCostBasis > 0 
      ? (demoState.unrealizedPnlSol / currentCostBasis) * 100 
      : 0;
  }
  
  function getTotalPnL() {
    return demoState.realizedPnlSol + demoState.unrealizedPnlSol;
  }
  
  function getTotalPnLPercent() {
    return demoState.totalBoughtSol > 0 
      ? (getTotalPnL() / demoState.totalBoughtSol) * 100 
      : 0;
  }
  
  function getCurrentPositionValue() {
    return demoState.position.remainingTokenAmount * demoState.currentPrice;
  }
  
  function getTotalPoolValue() {
    // Total pool = available cash + current position value
    // This represents the "total havuz" - what user would have if they closed everything
    return demoState.balance + getCurrentPositionValue();
  }

  // ============================================================
  // RENDER SYSTEM (Single Source of Truth for UI)
  // ============================================================
  
  function renderTradingPanel() {
    // Trading Panel stats (4 values at bottom)
    const stat1 = document.querySelector('.demo-stat-1'); // Total Bought
    const stat2 = document.querySelector('.demo-stat-2'); // Total Sold
    const stat3 = document.querySelector('.demo-stat-3'); // Position Value
    const stat4 = document.querySelector('.demo-stat-4'); // Total PnL
    
    if (stat1) stat1.textContent = formatSol(demoState.totalBoughtSol);
    if (stat2) stat2.textContent = formatSol(demoState.totalSoldSol);
    if (stat3) stat3.textContent = formatSol(getCurrentPositionValue());
    
    const totalPnl = getTotalPnL();
    const totalPnlPercent = getTotalPnLPercent();
    if (stat4) {
      stat4.textContent = `${formatSol(totalPnl)} (${formatPercent(totalPnlPercent)})`;
      stat4.style.color = totalPnl >= 0 ? '#37d6bd' : '#f04b92';
    }
    
    // Header balance - available cash only
    const headerBalance = document.querySelector('.demo-header-balance');
    if (headerBalance) {
      headerBalance.textContent = formatSol(demoState.balance);
    }
    
    // Entry MC and Current MC
    const entryMCEl = document.querySelector('#demo-entry-mc');
    const currentMCEl = document.querySelector('#demo-current-mc');
    
    if (entryMCEl) {
      entryMCEl.textContent = demoState.position.entryMarketCap 
        ? formatMarketCap(demoState.position.entryMarketCap) 
        : '--';
    }
    
    if (currentMCEl) {
      currentMCEl.textContent = demoState.position.remainingTokenAmount > 0 
        ? formatMarketCap(demoState.currentPrice) 
        : '--';
    }
  }
  
  function renderPnlBar() {
    // Balance display - available cash only
    const balanceNumber = document.querySelector('.sgs-balance-number');
    if (balanceNumber) {
      balanceNumber.textContent = formatSol(demoState.balance);
    }
    
    // PnL display - shows balance difference from initial (HAVUZ LOGIC)
    // PnL = Current Balance - Initial Balance
    // This shows profit/loss from CLOSED positions only
    // Open positions are NOT counted until sold
    const pnlNumber = document.querySelector('.sgs-pnl-number');
    const pnlValue = document.querySelector('.sgs-pnl-value');
    
    const havuzPnl = demoState.balance - demoState.initialBalance;
    
    if (pnlNumber) {
      pnlNumber.textContent = formatSol(havuzPnl);
    }
    
    if (pnlValue) {
      // Update color based on PnL
      if (havuzPnl > 0) {
        pnlValue.style.color = '#37d6bd'; // Green for positive
      } else if (havuzPnl < 0) {
        pnlValue.style.color = '#f04b92'; // Red for negative
      } else {
        pnlValue.style.color = '#9ca3af'; // Gray for zero
      }
    }
    
    // Open Positions area
    renderOpenPositions();
  }
  
  function renderOpenPositions() {
    const positionsArea = document.querySelector('.pnl-positions-area');
    if (!positionsArea) return;
    
    if (demoState.position.remainingTokenAmount > 0) {
      const pnlPercent = demoState.unrealizedPnlPercent;
      const pnlSol = demoState.unrealizedPnlSol;
      const pnlColor = pnlPercent >= 0 ? '#37d6bd' : '#f04b92';
      const pnlSign = pnlPercent >= 0 ? '+' : '';
      
      positionsArea.innerHTML = `
        <div style="padding: 8px 14px; background: rgba(31, 32, 35, 0.4); backdrop-filter: blur(6px); border: 1px solid rgba(67, 73, 82, 0.3); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #fff;">${demoState.position.token}</div>
              <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${formatSol(demoState.position.remainingInvestedSol)} SOL</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; font-weight: 600; color: ${pnlColor};">${pnlSign}${pnlPercent.toFixed(1)}%</div>
              <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">${pnlSign}${formatSol(pnlSol)} SOL</div>
            </div>
          </div>
        </div>
      `;
      
      expandPnLBar();
    } else {
      positionsArea.innerHTML = '<div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">No open positions</div>';
      
      // Collapse if no position
      if (demoState.status === DEMO_STATES.IDLE || demoState.status === DEMO_STATES.POSITION_CLOSED) {
        collapsePnLBar();
      }
    }
  }
  
  function renderDemoState() {
    updateDemoCalculations();
    renderTradingPanel();
    renderPnlBar();
  }
  
  function expandPnLBar() {
    const expandBtn = document.querySelector('.pnl-expand-btn');
    const positionsArea = document.querySelector('.pnl-positions-area');
    
    if (expandBtn && positionsArea && !expandBtn.classList.contains('expanded')) {
      expandBtn.classList.add('expanded');
      positionsArea.classList.add('expanded');
    }
  }

  function collapsePnLBar() {
    const expandBtn = document.querySelector('.pnl-expand-btn');
    const positionsArea = document.querySelector('.pnl-positions-area');
    
    if (expandBtn && positionsArea) {
      expandBtn.classList.remove('expanded');
      positionsArea.classList.remove('expanded');
    }
  }

  // ============================================================
  // TOAST SYSTEM (Matching Original Simora Design)
  // ============================================================
  
  let toastQueue = [];
  const MAX_TOASTS = 3;
  
  function showToast(message, state = 'success', duration = 2500) {
    const viewport = document.querySelector('.browser-mockup-viewport');
    if (!viewport) return null;
    
    // Create toast container if not exists
    let toastContainer = viewport.querySelector('.demo-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'demo-toast-container';
      toastContainer.style.cssText = `
        position: absolute;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 6px;
        pointer-events: none;
      `;
      viewport.appendChild(toastContainer);
    }
    
    // Remove oldest toast if limit reached
    const existingToasts = toastContainer.querySelectorAll('.demo-toast');
    if (existingToasts.length >= MAX_TOASTS) {
      const oldest = existingToasts[0];
      oldest.classList.add('toast-hide');
      setTimeout(() => oldest.remove(), 350);
    }
    
    // Create toast (matching pt-toast design from original)
    const toast = document.createElement('div');
    toast.className = `demo-toast demo-toast-${state}`;
    toast.style.cssText = `
      background: #111827;
      border: 1px solid #35383f;
      border-radius: 4px;
      padding: 13px 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      font-size: 11px;
      color: #bdbdbd;
      font-weight: 500;
      min-width: 280px;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    
    // Icon
    const icon = document.createElement('div');
    icon.className = 'demo-toast-icon';
    icon.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    `;
    
    if (state === 'pending') {
      icon.style.color = '#9ca3af';
      icon.innerHTML = '<div style="width: 11px; height: 11px; border: 2px solid rgba(156, 163, 175, 0.3); border-top-color: #9ca3af; border-radius: 50%; animation: demo-spin 0.8s linear infinite;"></div>';
    } else if (state === 'success') {
      icon.style.color = '#00cc88';
      icon.textContent = '✓';
    } else if (state === 'error') {
      icon.style.color = '#ff4444';
      icon.textContent = '✕';
    }
    
    // Text
    const text = document.createElement('div');
    text.className = 'demo-toast-text';
    text.style.cssText = 'text-align: center; font-weight: 500;';
    text.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    toastContainer.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    
    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('toast-hide');
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 350);
      }, duration);
    }
    
    return toast;
  }
  
  function updateToast(toast, message, state = 'success') {
    if (!toast) return;
    
    const icon = toast.querySelector('.demo-toast-icon');
    const text = toast.querySelector('.demo-toast-text');
    
    // Update state class
    toast.className = `demo-toast demo-toast-${state}`;
    
    // Update icon
    if (icon) {
      if (state === 'success') {
        icon.style.color = '#00cc88';
        icon.textContent = '✓';
      } else if (state === 'error') {
        icon.style.color = '#ff4444';
        icon.textContent = '✕';
      }
    }
    
    // Update text
    if (text) {
      text.textContent = message;
    }
  }

  // ============================================================
  // BUY GLOW EFFECT
  // ============================================================
  
  let glowTimeout = null;
  
  function startBuyGlow() {
    stopBuyGlow();
    
    glowTimeout = setTimeout(() => {
      const buyButtons = document.querySelectorAll('button[data-action="buy"]');
      const firstBuyButton = buyButtons[0]; // 0.1 SOL button
      
      if (firstBuyButton && demoState.status === DEMO_STATES.IDLE) {
        firstBuyButton.classList.add('demo-glow');
      }
    }, 5000);
  }

  function stopBuyGlow() {
    if (glowTimeout) {
      clearTimeout(glowTimeout);
      glowTimeout = null;
    }
    
    const buyButtons = document.querySelectorAll('button[data-action="buy"]');
    buyButtons.forEach(btn => btn.classList.remove('demo-glow'));
  }

  // ============================================================
  // DEMO ACTIONS - BUY
  // ============================================================
  
  function handleBuy(amount) {
    // Prevent duplicate clicks
    if (demoState.isProcessing) return;
    
    // Validate balance
    if (amount > demoState.balance) {
      showToast('Insufficient demo balance', 'error', 2500);
      return;
    }
    
    demoState.isProcessing = true;
    stopBuyGlow();
    
    // Show loading toast
    const loadingToast = showToast(`Attempting BUY ${formatSol(amount)} SOL...`, 'pending', 0);
    
    // Simulate network delay
    setTimeout(() => {
      // Calculate tokens purchased (simplified: 1 SOL = 1 token at current price)
      const tokensPurchased = amount / demoState.currentPrice;
      
      // Deduct from balance
      demoState.balance -= amount;
      
      // Update position
      if (demoState.position.tokenAmount === 0) {
        // First buy - set entry price
        demoState.position.averageEntryPrice = demoState.currentPrice;
        demoState.position.entryMarketCap = demoState.currentPrice;
        demoState.position.tokenAmount = tokensPurchased;
        demoState.position.remainingTokenAmount = tokensPurchased;
        demoState.position.investedSol = amount;
        demoState.position.remainingInvestedSol = amount;
        
        demoState.status = DEMO_STATES.POSITION_OPEN;
      } else {
        // Additional buy - calculate new average entry
        const previousCost = demoState.position.averageEntryPrice * demoState.position.remainingTokenAmount;
        const newCost = amount;
        const totalTokens = demoState.position.remainingTokenAmount + tokensPurchased;
        
        demoState.position.averageEntryPrice = (previousCost + newCost) / totalTokens;
        demoState.position.tokenAmount += tokensPurchased;
        demoState.position.remainingTokenAmount = totalTokens;
        demoState.position.investedSol += amount;
        demoState.position.remainingInvestedSol += amount;
      }
      
      // Update trade history
      demoState.totalBoughtSol += amount;
      demoState.buyCount++;
      
      // Start chart simulation if not already running
      if (!chartAnimationId) {
        startChartSimulation();
      }
      
      // Update UI
      renderDemoState();
      
      // Update loading toast to success
      updateToast(loadingToast, `BUY: ${formatSol(amount)} SOL @ MC ${formatMarketCap(demoState.currentPrice)}`, 'success');
      
      // Remove success toast after delay
      setTimeout(() => {
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.classList.add('toast-hide');
          loadingToast.style.opacity = '0';
          loadingToast.style.transform = 'translateY(-10px)';
          setTimeout(() => loadingToast.remove(), 350);
        }
      }, 2500);
      
      demoState.isProcessing = false;
    }, 800); // 800ms network delay
  }

  // ============================================================
  // DEMO ACTIONS - SELL
  // ============================================================
  
  function handleSell(percentage) {
    // Prevent duplicate clicks
    if (demoState.isProcessing) return;
    
    // Validate position
    if (demoState.position.remainingTokenAmount <= 0) {
      showToast('No open position', 'error', 2500);
      return;
    }
    
    demoState.isProcessing = true;
    
    // Show loading toast
    const loadingToast = showToast(`Attempting SELL ${percentage}%...`, 'pending', 0);
    
    // Simulate network delay
    setTimeout(() => {
      const sellRatio = percentage / 100;
      
      // Calculate tokens to sell
      const tokensToSell = demoState.position.remainingTokenAmount * sellRatio;
      
      // Calculate sale value at current price
      const saleValueSol = tokensToSell * demoState.currentPrice;
      
      // Calculate cost basis of sold tokens
      const costBasisSold = tokensToSell * demoState.position.averageEntryPrice;
      
      // Calculate realized PnL
      const realizedPnl = saleValueSol - costBasisSold;
      
      // Add sale value to balance (includes cost basis + profit/loss)
      demoState.balance += saleValueSol;
      
      // Update position
      demoState.position.remainingTokenAmount -= tokensToSell;
      demoState.position.remainingInvestedSol -= costBasisSold;
      
      // Handle floating point errors
      if (demoState.position.remainingTokenAmount < 0.0000001) {
        demoState.position.remainingTokenAmount = 0;
        demoState.position.remainingInvestedSol = 0;
      }
      
      // Update PnL tracking
      demoState.realizedPnlSol += realizedPnl;
      
      // Update trade history
      demoState.totalSoldSol += saleValueSol;
      demoState.sellCount++;
      
      // Update status
      if (demoState.position.remainingTokenAmount === 0) {
        demoState.status = DEMO_STATES.POSITION_CLOSED;
      } else {
        demoState.status = DEMO_STATES.PARTIALLY_SOLD;
      }
      
      // Update UI
      renderDemoState();
      
      // Update loading toast to success
      const pnlSign = realizedPnl >= 0 ? '+' : '';
      updateToast(loadingToast, `SELL: ${percentage}% @ MC ${formatMarketCap(demoState.currentPrice)} | PnL: ${pnlSign}${formatSol(realizedPnl)} SOL`, 'success');
      
      // Remove success toast after delay
      setTimeout(() => {
        if (loadingToast && loadingToast.parentNode) {
          loadingToast.classList.add('toast-hide');
          loadingToast.style.opacity = '0';
          loadingToast.style.transform = 'translateY(-10px)';
          setTimeout(() => loadingToast.remove(), 350);
        }
      }, 2500);
      
      // If fully closed, show final results and reset
      if (demoState.status === DEMO_STATES.POSITION_CLOSED) {
        stopChartSimulation();
        
        // Show final result toast
        setTimeout(() => {
          const finalPnl = demoState.realizedPnlSol;
          const finalPnlSign = finalPnl >= 0 ? '+' : '';
          showToast(`POSITION CLOSED | Final PnL: ${finalPnlSign}${formatSol(finalPnl)} SOL | Balance: ${formatSol(demoState.balance)} SOL`, 'success', 3000);
        }, 3000);
        
        // Reset after showing final results
        setTimeout(() => {
          resetDemo();
        }, 6000);
      }
      
      demoState.isProcessing = false;
    }, 800); // 800ms network delay
  }

  // ============================================================
  // RESET
  // ============================================================
  
  function resetDemo() {
    demoState.status = DEMO_STATES.RESETTING;
    
    stopChartSimulation();
    collapsePnLBar();
    
    // Reset state after brief delay
    setTimeout(() => {
      // Reset session
      demoState.status = DEMO_STATES.IDLE;
      demoState.balance = demoState.initialBalance;
      demoState.currentPrice = demoState.initialMarketCap;
      
      // Reset position
      demoState.position = {
        token: 'SIMORA',
        tokenAmount: 0,
        remainingTokenAmount: 0,
        investedSol: 0,
        remainingInvestedSol: 0,
        averageEntryPrice: 0,
        entryMarketCap: 0
      };
      
      // Reset PnL
      demoState.unrealizedPnlSol = 0;
      demoState.unrealizedPnlPercent = 0;
      demoState.realizedPnlSol = 0;
      
      // Reset trade history
      demoState.totalBoughtSol = 0;
      demoState.totalSoldSol = 0;
      demoState.buyCount = 0;
      demoState.sellCount = 0;
      
      demoState.isProcessing = false;
      
      // Update UI
      renderDemoState();
      
      // Restart glow
      startBuyGlow();
    }, 500);
  }

  // ============================================================
  // EVENT LISTENERS - SINGLE ATTACHMENT
  // ============================================================
  
  let listenersAttached = false;
  
  function attachEventListeners() {
    // Prevent duplicate listener attachment
    if (listenersAttached) {
      console.log('[Paper Trading Demo] Listeners already attached, skipping...');
      return;
    }
    
    // Buy buttons
    const buyButtons = document.querySelectorAll('button[data-action="buy"]');
    const amounts = [0.1, 0.2, 0.5, 1.0];
    
    buyButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleBuy(amounts[index]);
      }, { once: false }); // Not using 'once' to allow multiple trades
    });
    
    // Sell buttons
    const sellButtons = document.querySelectorAll('button[data-action="sell"]');
    const percentages = [10, 25, 50, 100];
    
    sellButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        handleSell(percentages[index]);
      }, { once: false });
    });
    
    listenersAttached = true;
    console.log('[Paper Trading Demo] Event listeners attached');
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  
  let initialized = false;
  
  function init() {
    // Prevent duplicate initialization
    if (initialized) {
      console.log('[Paper Trading Demo] Already initialized, skipping...');
      return;
    }
    
    console.log('[Paper Trading Demo] Initializing...');
    
    // Check for desktop viewport
    if (window.innerWidth < 1024) {
      console.log('[Paper Trading Demo] Mobile/tablet detected - demo disabled');
      return;
    }
    
    // Attach event listeners once
    attachEventListeners();
    
    // Initial render
    renderDemoState();
    
    // Start buy glow effect
    startBuyGlow();
    
    initialized = true;
    console.log('[Paper Trading Demo] Initialization complete!');
  }

  // Auto-initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopChartSimulation();
    stopBuyGlow();
  });

  console.log('[Paper Trading Demo] Module loaded');

})();
