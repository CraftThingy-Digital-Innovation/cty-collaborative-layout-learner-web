/**
 * cty-collaborative-layout-learner-web
 * Federated Online Layout Learning & Prediction Engine
 * Public-Source Corporate Royalty License (PSCRL)
 * Copyright (c) 2026 CraftThingy Digital Innovation & Alif Nurhidayat
 */

export class CollaborativeLayoutLearner extends EventTarget {
  constructor(options = {}) {
    super();
    this.storageKey = options.storageKey || 'cty_collaborative_layouts';
    this.syncInterval = options.syncInterval || 10000; // Check server every 10 seconds
    
    // Load local templates from storage
    this.templates = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    this.version = parseInt(localStorage.getItem(`${this.storageKey}_version`) || '0', 10);
    
    this.timer = null;
    this.apiUrl = null;
  }

  /**
   * Learns a new anchor-value layout pair from user click interaction.
   * @param {string} docType The type of document (e.g. 'paspor_indonesia')
   * @param {string} field Name of the input field (e.g. 'nama_pemohon')
   * @param {string} selectedText Text value of the clicked bounding box
   * @param {object} selectedBox Coordinates of the value box: { x, y, width, height }
   * @param {Array} allWords All detected word objects in this scan: [ { text, box: { x, y, width, height } } ]
   * @param {number} imgWidth Width of the image during coordinate normalization
   * @param {number} imgHeight Height of the image during coordinate normalization
   */
  learn(docType, field, selectedText, selectedBox, allWords, imgWidth, imgHeight) {
    if (!docType || !field || !selectedBox || !allWords || !imgWidth || !imgHeight) return;

    if (!this.templates[docType]) {
      this.templates[docType] = {};
    }

    // Value coordinates normalized relative to image size
    const valRelX = selectedBox.x / imgWidth;
    const valRelY = selectedBox.y / imgHeight;
    const valRelW = selectedBox.width / imgWidth;
    const valRelH = selectedBox.height / imgHeight;

    // Search for closest anchor text box within a search radius (e.g. 25% of image size)
    let closestAnchor = null;
    let minDistance = Infinity;

    allWords.forEach(word => {
      // Skip numeric-only/special characters boxes as anchors
      if (/^[\d\s-:,./\\]+$/.test(word.text) || word.text === selectedText) return;
      if (!word.box) return;

      const wRelX = word.box.x / imgWidth;
      const wRelY = word.box.y / imgHeight;

      // Distance calculation
      const dx = valRelX - wRelX;
      const dy = valRelY - wRelY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDistance && dist < 0.25) {
        minDistance = dist;
        closestAnchor = word;
      }
    });

    let relativeDirection = 'below';
    let anchorText = '';

    if (closestAnchor) {
      anchorText = closestAnchor.text.toLowerCase().trim();
      const aRelX = closestAnchor.box.x / imgWidth;
      const aRelY = closestAnchor.box.y / imgHeight;

      const dx = valRelX - aRelX;
      const dy = valRelY - aRelY;

      // Determine absolute direction relative to anchor
      if (Math.abs(dx) > Math.abs(dy)) {
        relativeDirection = dx > 0 ? 'right' : 'left';
      } else {
        relativeDirection = dy > 0 ? 'below' : 'above';
      }
    }

    // Set or average spatial layout data
    const existing = this.templates[docType][field] || null;

    if (existing) {
      // Exponential moving average for smooth adaptation
      existing.relativeX = (existing.relativeX * 0.7) + (valRelX * 0.3);
      existing.relativeY = (existing.relativeY * 0.7) + (valRelY * 0.3);
      existing.relativeW = (existing.relativeW * 0.7) + (valRelW * 0.3);
      existing.relativeH = (existing.relativeH * 0.7) + (valRelH * 0.3);
      
      if (closestAnchor && anchorText) {
        if (!existing.keywords.includes(anchorText)) {
          existing.keywords.push(anchorText);
        }
        existing.direction = relativeDirection;
      }
    } else {
      this.templates[docType][field] = {
        relativeX: valRelX,
        relativeY: valRelY,
        relativeW: valRelW,
        relativeH: valRelH,
        keywords: closestAnchor ? [anchorText] : [],
        direction: relativeDirection
      };
    }

    this.version++;
    this.save();
    
    this.dispatchEvent(new CustomEvent('update', {
      detail: { docType, field, template: this.templates[docType][field] }
    }));
  }

  /**
   * Automatically predicts and pre-fills input values based on learned layouts.
   * @param {string} docType The type of document to match against
   * @param {Array} allWords All detected word objects: [ { text, box: { x, y, width, height } } ]
   * @param {number} imgWidth Current image width
   * @param {number} imgHeight Current image height
   */
  predict(docType, allWords, imgWidth, imgHeight) {
    if (!docType || !this.templates[docType] || !allWords || !imgWidth || !imgHeight) return {};

    const docTemplate = this.templates[docType];
    const predictions = {};

    Object.keys(docTemplate).forEach(field => {
      const config = docTemplate[field];
      let bestCandidate = null;
      let highestScore = -1;

      allWords.forEach(word => {
        if (!word.box) return;

        const wRelX = word.box.x / imgWidth;
        const wRelY = word.box.y / imgHeight;

        // 1. Distance Score (Euclidean Distance to predicted center)
        const dx = wRelX - config.relativeX;
        const dy = wRelY - config.relativeY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const distScore = Math.max(0, 1 - dist / 0.3); // High score for close proximity

        // 2. Keyword/Anchor Proximity Score
        let anchorScore = 0;
        if (config.keywords.length > 0) {
          // Look for nearby anchor words matching configuration keywords
          allWords.forEach(otherWord => {
            if (otherWord === word || !otherWord.box) return;
            const otherText = otherWord.text.toLowerCase().trim();

            if (config.keywords.some(kw => otherText.includes(kw))) {
              const odx = wRelX - (otherWord.box.x / imgWidth);
              const ody = wRelY - (otherWord.box.y / imgHeight);
              const oDist = Math.sqrt(odx * odx + ody * ody);

              if (oDist < 0.25) {
                // Check if direction is respected
                let isDirectionValid = false;
                if (config.direction === 'below' && ody > 0) isDirectionValid = true;
                if (config.direction === 'above' && ody < 0) isDirectionValid = true;
                if (config.direction === 'right' && odx > 0) isDirectionValid = true;
                if (config.direction === 'left' && odx < 0) isDirectionValid = true;

                const scoreAdd = isDirectionValid ? (1 - oDist / 0.25) : (0.5 * (1 - oDist / 0.25));
                if (scoreAdd > anchorScore) {
                  anchorScore = scoreAdd;
                }
              }
            }
          });
        }

        // 3. Multi-Factor Scoring
        const score = (distScore * 0.6) + (anchorScore * 0.4);

        if (score > highestScore && score > 0.45) {
          highestScore = score;
          bestCandidate = word.text;
        }
      });

      if (bestCandidate) {
        predictions[field] = bestCandidate;
      }
    });

    return predictions;
  }

  /**
   * Starts the background collaborative syncing with remote server.
   * @param {string} apiUrl The endpoint URL for template aggregation sync
   */
  startSync(apiUrl) {
    if (!apiUrl) return;
    this.apiUrl = apiUrl;
    
    if (this.timer) return;
    
    // Sync immediately on start
    this.performSync();
    
    this.timer = setInterval(() => this.performSync(), this.syncInterval);
  }

  /**
   * Stops the background synchronization
   */
  stopSync() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Internal sync logic pushing local changes and downloading global updates
   */
  async performSync() {
    if (!this.apiUrl) return;
    
    try {
      const response = await fetch(`${this.apiUrl}/sync-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          version: this.version,
          templates: this.templates
        })
      });

      const result = await response.json();
      
      if (result.status === 'success' && result.has_update) {
        // Overwrite local templates with aggregated server version
        this.templates = result.templates;
        this.version = result.version;
        this.save();
        
        this.dispatchEvent(new CustomEvent('sync-success', {
          detail: { templates: this.templates, version: this.version }
        }));
      }
    } catch (err) {
      console.warn("Federated layout sync check failed:", err);
      this.dispatchEvent(new CustomEvent('sync-error', { detail: err }));
    }
  }

  /**
   * Persists state locally
   */
  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.templates));
    localStorage.setItem(`${this.storageKey}_version`, this.version.toString());
  }

  /**
   * Register event listener shortcut
   */
  on(event, callback) {
    this.addEventListener(event, (e) => callback(e.detail));
  }
}

if (typeof window !== 'undefined') {
  window.CollaborativeLayoutLearner = CollaborativeLayoutLearner;
}
