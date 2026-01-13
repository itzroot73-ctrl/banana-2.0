/**
 * 🍌 BananaMoney Lite - Core Bot
 */

import mineflayer from 'mineflayer';
import readline from 'readline';
import Logger from './utils/logger.js';
import { AliasManager } from './utils/AliasManager.js';
import { saveConfig } from './utils/config.js';
import { BoneCollector } from './modules/BoneCollector.js';
import { GuiManager } from './modules/GuiManager.js';
import { AutoSell } from './modules/AutoSell.js';
import autoEat from 'mineflayer-auto-eat';

export class BananaBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.boneCollector = null;
        this.guiManager = null;
        this.aliasManager = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '🍌 > '
        });

        // Connect logger to readline for clean output
        Logger.setReadline(this.rl);
    }

    /**
     * Initialize the bot
     */
    init() {
        Logger.showBanner();
        this.connect();
        this.setupConsole();
        this.rl.prompt();
    }

    /**
     * Connect to Minecraft server
     */
    connect() {
        Logger.system(`Connecting to ${this.config.host} as ${this.config.username}...`);

        this.bot = mineflayer.createBot({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            version: this.config.version,
            auth: this.config.auth,
            hideErrors: true,
            physicsEnabled: true
        });

        // Fix for different import types
        const eatPlugin = autoEat.plugin || autoEat.default || autoEat;
        this.bot.loadPlugin(eatPlugin);

        this.setupEvents();
        this.initModules();
    }

    /**
     * Initialize modules
     */
    initModules() {
        this.boneCollector = new BoneCollector(this.bot, this.config);
        this.guiManager = new GuiManager(this.bot);
        this.aliasManager = new AliasManager(this.config);

        // Auto Sell
        this.autoSell = new AutoSell(this.bot, this.config);
        if (this.config.autoSell?.enabled) {
            this.bot.once('spawn', () => this.autoSell.start());
        }

        this.bot.once('spawn', () => {
            this.boneCollector.init();
            // Auto Eat initialization
            if (this.bot.autoEat) {
                this.bot.autoEat.options = {
                    priority: 'foodPoints',
                    startAt: 14, // Eat when hunger < 14
                    bannedFood: [] // Add banned foods here if needed
                };
                Logger.system('🍖 Auto-Eat: ACTIVE');
            }
        });
    }

    /**
     * Setup bot events
     */
    setupEvents() {
        // Catch unhandled errors from mineflayer internals (like the passengers bug)
        this.bot._client.on('error', (err) => {
            Logger.error(`Protocol error (ignored): ${err.message}`);
        });

        // Catch uncaught exceptions to prevent crash
        process.on('uncaughtException', (err) => {
            // Ignore the known mineflayer passengers bug
            if (err.message?.includes('passengers') || err.message?.includes('Cannot read properties of undefined')) {
                Logger.error(`Mineflayer bug caught (ignored): ${err.message}`);
                return;
            }
            Logger.error(`Uncaught Exception: ${err.message}`);
            console.error(err.stack);
        });

        // Catch unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            Logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
            // Do not exit
        });

        this.bot.on('spawn', () => {
            Logger.system('Bot successfully spawned! 🍌');
            Logger.system('Use !help for commands');
        });

        this.bot.on('messagestr', (message, position, jsonMsg) => {
            if (position === 'game_info') return;
            Logger.log(message, 'CHAT');
        });

        this.bot.on('windowOpen', (window) => {
            Logger.system(`Window opened: ${window.title || window.type}`);
        });

        this.bot.on('error', (err) => {
            Logger.error(`Error: ${err.message}`);
        });

        this.bot.on('kicked', (reason) => {
            let msg = reason;
            try {
                const json = JSON.parse(reason);
                msg = json.text || json.translate || json.extra?.[0]?.text || reason;
            } catch (e) {
                if (typeof reason === 'object') {
                    msg = reason.text || reason.translate || JSON.stringify(reason);
                }
            }
            Logger.error(`Kicked: ${msg}`);
        });

        this.bot.on('end', () => {
            Logger.error('Disconnected. Reconnecting in 5s...');
            if (this.config.autoReconnect) {
                setTimeout(() => this.connect(), this.config.reconnectDelay);
            }
        });
    }

    /**
     * Setup console input
     */
    setupConsole() {
        this.rl.on('line', (input) => {
            const raw = input.trim();

            if (!raw) {
                this.rl.prompt();
                return;
            }

            // Resolve aliases
            if (this.aliasManager) {
                raw = this.aliasManager.resolve(raw);
            }

            // Check for command prefix
            if (raw.startsWith('!')) {
                this.handleCommand(raw.slice(1));
            } else {
                // Regular chat
                if (this.bot && this.bot.entity) {
                    this.bot.chat(raw);
                    Logger.log(`[YOU] ${raw}`, 'CHAT');
                } else {
                    Logger.error('Bot not connected.');
                }
            }

            this.rl.prompt();
        });
    }

    /**
     * Handle console commands
     */
    handleCommand(input) {
        const args = input.toLowerCase().split(' ');
        const cmd = args[0];

        switch (cmd) {
            case 'help':
                Logger.system('=== Commands ===');
                Logger.info('!bones on/off - Toggle bone collector');
                Logger.info('!gui          - Show current window');
                Logger.info('!click <slot> - Click window slot');
                Logger.info('!shift <slot> - Shift-click slot');
                Logger.info('!shift <slot> - Shift-click slot');
                Logger.info('!close        - Close window');
                Logger.info('!spawner x y z   - Set spawner position');
                Logger.info('!chest x y z     - Set chest position');
                Logger.info('!sell on/off     - Toggle auto-sell');
                Logger.info('!sell interval <s> - Set sell delay (seconds)');
                Logger.info('!sell cmd <cmd>  - Set sell command');
                Logger.info('(No prefix)      - Send chat message');
                break;

            case 'sell':
                if (!args[1]) {
                    Logger.error('Usage: !sell <on|off|interval|cmd>');
                    return;
                }

                if (args[1] === 'on') {
                    if (this.autoSell) {
                        this.autoSell.start();
                        this.config.autoSell.enabled = true;
                        saveConfig(this.config);
                    }
                } else if (args[1] === 'off') {
                    if (this.autoSell) {
                        this.autoSell.stop();
                        this.config.autoSell.enabled = false;
                        saveConfig(this.config);
                    }
                } else if (args[1] === 'interval') {
                    const seconds = parseInt(args[2]);
                    if (!isNaN(seconds) && seconds > 0) {
                        if (this.autoSell) this.autoSell.setIntervalTime(seconds * 1000);
                        saveConfig(this.config);
                    } else {
                        Logger.error('Invalid interval. Usage: !sell interval <seconds>');
                    }
                } else if (args[1] === 'cmd') {
                    // Reconstruct command from remaining args (handling spaces)
                    const newCmd = input.split(' ').slice(2).join(' ');
                    if (newCmd) {
                        if (this.autoSell) this.autoSell.setCommand(newCmd);
                        saveConfig(this.config);
                    } else {
                        Logger.error('Usage: !sell cmd <command>');
                    }
                } else {
                    Logger.error('Usage: !sell <on|off|interval|cmd>');
                }
                break;

            case 'bones':
                if (args[1] === 'on') {
                    if (this.boneCollector) this.boneCollector.start();
                } else if (args[1] === 'off') {
                    if (this.boneCollector) this.boneCollector.stop();
                } else {
                    Logger.error('Usage: !bones on/off');
                }
                break;

            case 'gui':
            case 'window':
                if (this.guiManager) this.guiManager.showWindow();
                break;

            case 'click':
                if (args[1] && this.guiManager) {
                    this.guiManager.clickSlot(args[1]);
                } else {
                    Logger.error('Usage: !click <slot>');
                }
                break;

            case 'shift':
                if (args[1] && this.guiManager) {
                    this.guiManager.shiftClick(args[1]);
                } else {
                    Logger.error('Usage: !shift <slot>');
                }
                break;

            case 'close':
                if (this.guiManager) this.guiManager.closeWindow();
                break;

            case 'spawner':
                if (args.length === 4) {
                    const x = parseInt(args[1]);
                    const y = parseInt(args[2]);
                    const z = parseInt(args[3]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        this.config.boneCollector.spawnerPos = { x, y, z };
                        import('./utils/config.js').then(({ saveConfig }) => {
                            if (saveConfig(this.config)) {
                                Logger.system(`Spawner position updated to ${x}, ${y}, ${z}`);
                            } else {
                                Logger.error('Failed to save config');
                            }
                        });
                        // Update runtime module if active
                        if (this.boneCollector) this.boneCollector.config.spawnerPos = { x, y, z };
                    } else {
                        Logger.error('Invalid coordinates. Usage: !spawner <x> <y> <z>');
                    }
                } else {
                    Logger.error('Usage: !spawner <x> <y> <z>');
                }
                break;

            case 'chest':
                if (args.length === 4) {
                    const x = parseInt(args[1]);
                    const y = parseInt(args[2]);
                    const z = parseInt(args[3]);
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        this.config.boneCollector.chestPos = { x, y, z };
                        import('./utils/config.js').then(({ saveConfig }) => {
                            if (saveConfig(this.config)) {
                                Logger.system(`Chest position updated to ${x}, ${y}, ${z}`);
                            } else {
                                Logger.error('Failed to save config');
                            }
                        });
                        // Update runtime module if active
                        if (this.boneCollector) this.boneCollector.config.chestPos = { x, y, z };
                    } else {
                        Logger.error('Invalid coordinates. Usage: !chest <x> <y> <z>');
                    }
                } else {
                    Logger.error('Usage: !chest <x> <y> <z>');
                }
                break;

            default:
                Logger.error(`Unknown command: ${cmd}. Type !help`);
        }
    }
}
