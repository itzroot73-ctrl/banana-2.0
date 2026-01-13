/**
 * 🍌 BananaMoney Lite - Auto Sell Module
 * Automatically runs a sell command at intervals
 */

import Logger from '../utils/logger.js';

export class AutoSell {
    constructor(bot, config) {
        this.bot = bot;
        this.config = config.autoSell || {};
        this.intervalId = null;
        this.enabled = this.config.enabled || false;
        this.command = this.config.command || '/sell all';
        this.interval = this.config.interval || 300000;
    }

    start() {
        if (this.intervalId) return;

        Logger.system(`💰 Auto-Sell: STARTED (${(this.interval / 1000).toFixed(0)}s interval)`);

        // Run immediately once
        this.sell();

        this.intervalId = setInterval(() => {
            this.sell();
        }, this.interval);
    }

    setIntervalTime(ms) {
        this.interval = ms;
        this.config.interval = ms;
        if (this.enabled) {
            this.stop();
            this.start();
        }
        Logger.system(`💰 Interval set to ${(ms / 1000).toFixed(0)}s`);
    }

    setCommand(cmd) {
        this.command = cmd;
        this.config.command = cmd;
        Logger.system(`💰 Command set to: ${cmd}`);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        Logger.system('💰 Auto-Sell: STOPPED');
    }

    toggle() {
        if (this.intervalId) {
            this.stop();
            this.enabled = false;
        } else {
            this.start();
            this.enabled = true;
        }
        return this.enabled;
    }

    sell() {
        if (!this.bot || !this.bot.entity) return;

        Logger.system(`💰 Selling... (${this.command})`);
        this.bot.chat(this.command);
    }
}
