/**
 * Interactive Trade Panel Demo
 * Simora Landing Page - Interactive Demo Component
 * 
 * Implements drag-and-drop and resize with dynamic button layout
 * Based on content.js implementation
 */

(function() {
  'use strict';

  // ============================================================
  // GLOBAL STATE
  // ============================================================
  
  let isResizing = false;
  let resizePointerId = null;

  // ============================================================
  // PANEL HEIGHT LAYOUT (from content.js)
  // ============================================================
  
  function updateButtonBorderRadius(mainSections) {
    if (!mainSections) return;
    
    // Get all button grids
    const grids = mainSections.querySelectorAll('.grid');
    
    grids.forEach(grid => {
      const buttons = grid.querySelectorAll('button[data-action]');
      
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Border radius = half of the shortest side
        const minDimension = Math.min(width, height);
        const borderRadius = minDimension / 2;
        
        button.style.borderRadius = `${borderRadius}px`;
      });
    });
  }
  
  function getPanelHeightMetrics(panelEl, mainSections) {
    const measuredCompactHeight = mainSections.dataset.compactHeight
      ? parseFloat(mainSections.dataset.compactHeight)
      : mainSections.getBoundingClientRect().height;

    const compactHeight = Number.isFinite(measuredCompactHeight)
      ? measuredCompactHeight
      : 180;

    const firstGrid = mainSections.querySelector('.grid');
    const gridWidth = firstGrid?.getBoundingClientRect().width
      || Math.max(0, panelEl.getBoundingClientRect().width - 24);
    const buttonWidth = Math.max(28, (gridWidth - 18) / 4);
    const nearCircleHeight = Math.min(74, buttonWidth);

    const splitHeight = compactHeight + Math.max(64, (nearCircleHeight - 28) * 2);

    const panelRect = panelEl.getBoundingClientRect();
    const sectionsRect = mainSections.getBoundingClientRect();
    const fixedPanelHeight = Math.max(0, panelRect.height - sectionsRect.height);
    
    // Get viewport boundary
    const viewport = panelEl.closest('.browser-mockup-viewport') || document.body;
    const viewportRect = viewport.getBoundingClientRect();
    const panelTop = panelRect.top - viewportRect.top;
    
    const maxHeight = Math.max(
      compactHeight,
      viewportRect.height - panelTop - fixedPanelHeight - 16
    );

    return { compactHeight, splitHeight, maxHeight };
  }

  function applyPanelHeightLayout(panelEl, mainSections, requestedHeight) {
    const { compactHeight, splitHeight, maxHeight } = getPanelHeightMetrics(panelEl, mainSections);
    const numericHeight = Number(requestedHeight);
    const nextHeight = Math.min(
      maxHeight,
      Math.max(compactHeight, Number.isFinite(numericHeight) ? numericHeight : compactHeight)
    );

    mainSections.style.height = `${nextHeight}px`;
    panelEl.classList.toggle('pt-two-row', nextHeight >= splitHeight);
    
    // Update button border radius after layout change
    requestAnimationFrame(() => {
      updateButtonBorderRadius(mainSections);
    });

    return nextHeight;
  }

  // ============================================================
  // DRAG FUNCTIONALITY
  // ============================================================
  
  function enableDrag(panel, header) {
    if (!panel || !header) return;

    let dragging = false;
    let dragPointerId = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let panelStartLeft = 0;
    let panelStartTop = 0;
    let panelWidth = 0;
    let panelHeight = 0;

    header.style.cursor = 'grab';
    
    // Only add transition for Trade Panel, not PnL Bar
    if (panel.id === 'trade-panel-demo') {
      panel.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    }

    header.addEventListener('pointerdown', (e) => {
      // Only left click
      if (e.button !== 0) return;

      // Don't drag if resizing
      if (isResizing) return;

      // Don't drag if clicking buttons
      if (e.target.tagName === 'BUTTON') return;

      e.preventDefault();

      // Get panel position relative to parent container
      const panelRect = panel.getBoundingClientRect();
      const parentRect = panel.parentElement.getBoundingClientRect();

      dragging = true;
      dragPointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panelStartLeft = panelRect.left - parentRect.left;
      panelStartTop = panelRect.top - parentRect.top;
      panelWidth = panelRect.width;
      panelHeight = panelRect.height;

      header.style.cursor = 'grabbing';
      
      // Only apply drag effects to Trade Panel
      if (panel.id === 'trade-panel-demo') {
        panel.classList.add('pt-dragging');
      }

      // Capture pointer
      try {
        header.setPointerCapture(dragPointerId);
      } catch (err) {}

      const onPointerMove = (ev) => {
        if (!dragging || ev.pointerId !== dragPointerId) return;

        ev.preventDefault();

        const dx = ev.clientX - dragStartX;
        const dy = ev.clientY - dragStartY;

        const parentRect = panel.parentElement.getBoundingClientRect();
        const maxLeft = Math.max(0, parentRect.width - panelWidth);
        const maxTop = Math.max(0, parentRect.height - panelHeight);

        let newLeft = panelStartLeft + dx;
        let newTop = panelStartTop + dy;

        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;

        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
        panel.style.right = 'auto';
        panel.style.transform = 'none';
      };
      
      const finishDrag = (ev) => {
        if (!dragging || ev.pointerId !== dragPointerId) return;

        ev.preventDefault();

        dragging = false;
        dragPointerId = null;

        header.style.cursor = 'grab';
        
        // Only remove drag effects from Trade Panel
        if (panel.id === 'trade-panel-demo') {
          panel.classList.remove('pt-dragging');
        }

        try {
          header.releasePointerCapture(ev.pointerId);
        } catch (err) {}

        header.removeEventListener('pointermove', onPointerMove);
        header.removeEventListener('pointerup', finishDrag);
        header.removeEventListener('pointercancel', finishDrag);
      };

      header.addEventListener('pointermove', onPointerMove);
      header.addEventListener('pointerup', finishDrag);
      header.addEventListener('pointercancel', finishDrag);
    });
  }

  // ============================================================
  // RESIZE FUNCTIONALITY
  // ============================================================
  
  function enableResize(panel, handle, mainSections) {
    if (!panel || !handle) return;

    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;

    handle.style.cursor = 'nwse-resize';

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      isResizing = true;
      resizePointerId = e.pointerId;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;

      if (mainSections) {
        // Trade Panel
        const rect = panel.getBoundingClientRect();
        resizeStartWidth = rect.width;
        resizeStartHeight = mainSections.getBoundingClientRect().height;
      } else {
        // PnL Bar - get inner dimensions
        const pnlInner = panel.querySelector('.pnl-bar-inner');
        if (pnlInner) {
          const innerRect = pnlInner.getBoundingClientRect();
          resizeStartWidth = innerRect.width;
          resizeStartHeight = innerRect.height;
        }
      }

      document.body.classList.add('pt-resizing');

      try {
        handle.setPointerCapture(resizePointerId);
      } catch (err) {}

      const onPointerMove = (ev) => {
        if (!isResizing || ev.pointerId !== resizePointerId) return;

        ev.preventDefault();

        const dx = ev.clientX - resizeStartX;
        const dy = ev.clientY - resizeStartY;

        if (mainSections) {
          // Trade Panel - width resize + height layout
          let newWidth = resizeStartWidth + dx;
          const minWidth = 290; // Minimum width to prevent text wrapping in stats bar
          if (newWidth < minWidth) newWidth = minWidth;
          panel.style.width = `${newWidth}px`;
          
          applyPanelHeightLayout(panel, mainSections, resizeStartHeight + dy);
        } else {
          // PnL Bar - free resize with CSS variables
          const pnlInner = panel.querySelector('.pnl-bar-inner');
          if (pnlInner) {
            let newWidth = resizeStartWidth + dx;
            let newHeight = resizeStartHeight + dy;
            
            // Min/max constraints
            const minWidth = 200;
            const maxWidth = 600;
            const minHeight = 60;
            const maxHeight = 150;
            
            newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            
            // Apply size
            pnlInner.style.width = `${newWidth}px`;
            
            // Calculate UI scale based on limiting ratio (like content.js)
            const defaultWidth = 280;
            const defaultHeight = 70;
            const limitingRatio = Math.min(newWidth / defaultWidth, newHeight / defaultHeight);
            const uiScale = Math.max(0.68, Math.min(1.65, limitingRatio));
            const primaryValueBoost = uiScale > 1 ? Math.min(1.15, 1 + ((uiScale - 1) * 0.22)) : 1;
            const verticalPadding = Math.round(22 * uiScale);
            
            // Set CSS variables
            pnlInner.style.setProperty('--sgs-ui-scale', uiScale.toFixed(3));
            const primaryValueSize = Math.max(13, 24 * uiScale * primaryValueBoost);
            pnlInner.style.setProperty('--sgs-primary-value-size', `${primaryValueSize.toFixed(2)}px`);
            pnlInner.style.setProperty('--sgs-row-height', `${Math.max(30, newHeight - verticalPadding)}px`);
          }
        }
      };

      const finishResize = (ev) => {
        if (!isResizing || ev.pointerId !== resizePointerId) return;

        ev.preventDefault();

        isResizing = false;
        resizePointerId = null;
        document.body.classList.remove('pt-resizing');

        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch (err) {}

        handle.removeEventListener('pointermove', onPointerMove);
        handle.removeEventListener('pointerup', finishResize);
        handle.removeEventListener('pointercancel', finishResize);
      };

      handle.addEventListener('pointermove', onPointerMove);
      handle.addEventListener('pointerup', finishResize);
      handle.addEventListener('pointercancel', finishResize);
    });
  }

  // ============================================================
  // MOCK TRADING STATE
  // ============================================================
  
  let mockBalance = 5.0; // SOL
  let mockPosition = null; // { tokenAmount: number, avgEntry: number, pnlPercent: number }
  
  function updateMockUI() {
    // Update header balance
    const balanceEl = document.querySelector('.demo-header-balance');
    if (balanceEl) {
      balanceEl.textContent = mockBalance.toFixed(1);
    }
    
    // Update PnL bar positions area
    const positionsArea = document.querySelector('.pnl-positions-area');
    if (!positionsArea) return;
    
    if (!mockPosition || mockPosition.tokenAmount <= 0) {
      // No position
      positionsArea.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
          No open positions
        </div>
      `;
    } else {
      // Show position - ONLY 2 ROWS (actually 1 row with 3 columns)
      const pnlColor = mockPosition.pnlPercent >= 0 ? '#37d6bd' : '#f04b92';
      const pnlSign = mockPosition.pnlPercent >= 0 ? '+' : '';
      
      positionsArea.innerHTML = `
        <div style="padding: 12px; cursor: pointer; border-radius: 8px; transition: background 0.15s ease;" 
             onmouseenter="this.style.background='rgba(255,255,255,0.03)'" 
             onmouseleave="this.style.background='transparent'">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: #e5e7eb; flex-shrink: 0;">DEMO</div>
            <div style="font-size: 13px; font-weight: 700; color: ${pnlColor}; flex-shrink: 0;">${pnlSign}${mockPosition.pnlPercent.toFixed(1)}%</div>
            <div style="font-size: 12px; color: #9ca3af; text-align: right; flex-grow: 1;">${mockPosition.tokenAmount.toFixed(3)} SOL</div>
          </div>
        </div>
      `;
    }
    
    // Update PnL bar main value
    const pnlNumber = document.querySelector('.sgs-pnl-number');
    if (pnlNumber && mockPosition) {
      const totalValue = mockBalance + (mockPosition.tokenAmount || 0);
      const pnl = totalValue - 5.0; // Initial balance was 5.0
      pnlNumber.textContent = pnl >= 0 ? `+${pnl.toFixed(1)}` : pnl.toFixed(1);
    }
  }
  
  function executeMockBuy(solAmount) {
    if (mockBalance < solAmount) {
      console.log('[Demo] Insufficient balance');
      return;
    }
    
    // Deduct from balance
    mockBalance -= solAmount;
    
    // Add to position (mock price movement: random between -5% and +15%)
    const priceChange = -5 + Math.random() * 20; // -5% to +15%
    const currentValue = solAmount * (1 + priceChange / 100);
    
    if (!mockPosition) {
      mockPosition = {
        tokenAmount: currentValue,
        avgEntry: solAmount,
        pnlPercent: priceChange
      };
    } else {
      // Average in
      const totalEntry = mockPosition.avgEntry + solAmount;
      const totalCurrent = mockPosition.tokenAmount + currentValue;
      mockPosition.avgEntry = totalEntry;
      mockPosition.tokenAmount = totalCurrent;
      mockPosition.pnlPercent = ((totalCurrent - totalEntry) / totalEntry) * 100;
    }
    
    updateMockUI();
    console.log('[Demo] Buy executed:', { solAmount, balance: mockBalance, position: mockPosition });
  }
  
  function executeMockSell(percentage) {
    if (!mockPosition || mockPosition.tokenAmount <= 0) {
      console.log('[Demo] No position to sell');
      return;
    }
    
    // Calculate sell amount
    const sellAmount = (mockPosition.tokenAmount * percentage) / 100;
    const entryPortion = (mockPosition.avgEntry * percentage) / 100;
    
    // Add to balance
    mockBalance += sellAmount;
    
    // Reduce position
    mockPosition.tokenAmount -= sellAmount;
    mockPosition.avgEntry -= entryPortion;
    
    if (mockPosition.tokenAmount < 0.001) {
      mockPosition = null; // Close position
    } else {
      // Recalculate PnL%
      mockPosition.pnlPercent = ((mockPosition.tokenAmount - mockPosition.avgEntry) / mockPosition.avgEntry) * 100;
    }
    
    updateMockUI();
    console.log('[Demo] Sell executed:', { percentage, balance: mockBalance, position: mockPosition });
  }
  
  // ============================================================
  // INITIALIZATION
  // ============================================================
  
  const init = () => {
    console.log('[Interactive Demo] Initializing...');
    
    // Check for desktop viewport
    if (window.innerWidth < 1024) {
      console.log('[Interactive Demo] Mobile/tablet detected - interactions disabled');
      return;
    }
    
    // Setup buy/sell button handlers
    document.querySelectorAll('button[data-action="buy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const amount = parseFloat(btn.dataset.amount);
        if (amount) {
          executeMockBuy(amount);
        }
      });
    });
    
    document.querySelectorAll('button[data-action="sell"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const percentage = parseFloat(btn.dataset.percentage);
        if (percentage) {
          executeMockSell(percentage);
        }
      });
    });
    
    // Initialize UI
    updateMockUI();
    console.log('[Interactive Demo] Mock trading initialized');
    
    // Get panel elements
    const tradePanel = document.getElementById('trade-panel-demo');
    const pnlBar = document.getElementById('pnl-bar-demo');
    
    if (!tradePanel) {
      console.error('[Interactive Demo] Trade panel not found');
      return;
    }
    
    // Set up Trade Panel
    tradePanel.style.position = 'absolute';
    
    // Convert transform positioning to absolute positioning
    // Remove transform and set explicit top/left values
    const initialRect = tradePanel.getBoundingClientRect();
    const parentRect = tradePanel.parentElement.getBoundingClientRect();
    
    // Calculate current position relative to parent
    const currentLeft = initialRect.left - parentRect.left;
    const currentTop = initialRect.top - parentRect.top;
    
    // Set explicit positioning and remove transform
    tradePanel.style.left = `${currentLeft}px`;
    tradePanel.style.top = `${currentTop}px`;
    tradePanel.style.transform = 'none';
    tradePanel.style.right = 'auto';
    
    const tradePanelHeader = tradePanel.querySelector('.flex.items-center.justify-between');
    const tradePanelBody = tradePanel.querySelector('div.p-0');
    
    // Measure compact height - use body container
    if (tradePanelBody) {
      tradePanel.classList.add('pt-measuring');
      const compactRect = tradePanelBody.getBoundingClientRect();
      tradePanelBody.dataset.compactHeight = String(compactRect.height);
      tradePanel.classList.remove('pt-measuring');
      
      console.log('[Interactive Demo] Compact height:', compactRect.height);
    }
    
    let tradePanelResizeHandle = tradePanel.querySelector('.trade-panel-resize-handle');
    if (!tradePanelResizeHandle) {
      tradePanelResizeHandle = document.createElement('div');
      tradePanelResizeHandle.className = 'trade-panel-resize-handle';
      tradePanelResizeHandle.style.cssText = 'position: absolute; bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize; background: rgba(255,255,255,0.3); border-radius: 0 0 8px 0; z-index: 100;';
      tradePanel.appendChild(tradePanelResizeHandle);
    }
    
    if (tradePanelHeader) {
      enableDrag(tradePanel, tradePanelHeader);
      console.log('[Interactive Demo] Trade panel drag enabled');
    }
    
    enableResize(tradePanel, tradePanelResizeHandle, tradePanelBody);
    console.log('[Interactive Demo] Trade panel resize enabled');
    
    // Set initial button border radius
    updateButtonBorderRadius(tradePanelBody);
    console.log('[Interactive Demo] Button border radius initialized');
    
    // Set up PnL Bar
    if (pnlBar) {
      pnlBar.style.position = 'absolute';
      pnlBar.style.pointerEvents = 'auto';
      
      // Convert transform positioning to absolute positioning (same as Trade Panel)
      const pnlInitialRect = pnlBar.getBoundingClientRect();
      const pnlParentRect = pnlBar.parentElement.getBoundingClientRect();
      
      const pnlCurrentLeft = pnlInitialRect.left - pnlParentRect.left;
      const pnlCurrentTop = pnlInitialRect.top - pnlParentRect.top;
      
      pnlBar.style.left = `${pnlCurrentLeft}px`;
      pnlBar.style.top = `${pnlCurrentTop}px`;
      pnlBar.style.transform = 'none';
      pnlBar.style.right = 'auto';
      
      const pnlBarInner = pnlBar.querySelector('.pnl-bar-inner');
      
      if (pnlBarInner) {
        pnlBarInner.style.cursor = 'grab';
        pnlBarInner.style.pointerEvents = 'auto';
        
        let pnlBarResizeHandle = pnlBarInner.querySelector('.pnl-bar-resize-handle');
        if (!pnlBarResizeHandle) {
          pnlBarResizeHandle = document.createElement('div');
          pnlBarResizeHandle.className = 'pnl-bar-resize-handle';
          pnlBarResizeHandle.style.cssText = 'position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; cursor: nwse-resize; z-index: 100;';
          pnlBarInner.appendChild(pnlBarResizeHandle);
        }
        
        enableDrag(pnlBar, pnlBarInner);
        enableResize(pnlBar, pnlBarResizeHandle, null);
        
        // Setup expand/collapse functionality
        const expandBtn = pnlBar.querySelector('.pnl-expand-btn');
        const positionsArea = pnlBar.querySelector('.pnl-positions-area');
        
        if (expandBtn && positionsArea) {
          expandBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isExpanded = expandBtn.classList.contains('expanded');
            
            if (isExpanded) {
              // Collapse
              expandBtn.classList.remove('expanded');
              positionsArea.classList.remove('expanded');
            } else {
              // Expand
              expandBtn.classList.add('expanded');
              positionsArea.classList.add('expanded');
            }
          });
        }
        
        console.log('[Interactive Demo] PnL bar drag & resize enabled');
      }
    }
    
    console.log('[Interactive Demo] Initialization complete!');
  };

  // Auto-initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Interactive Demo] Module loaded');

})();
