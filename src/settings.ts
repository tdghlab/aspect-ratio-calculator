import { App, PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from './main';

export type SnapMode = 'off' | '8' | '16' | '32' | '64';

export interface SavedPreset {
    name: string;
    width: number;
    height: number;
    folder: string;
}

export interface ModelProfile {
    id: string;
    name: string;
    snap: SnapMode;
}

export interface MyPluginSettings {
    dpi: number;
    mode: string;
    round: boolean;
    oldWidth: number;
    oldHeight: number;
    newWidth: number;
    newHeight: number;
    printWidthIn: number;
    printHeightIn: number;
    lastChanged: 'width' | 'height';
    presets: SavedPreset[];
    folders: string[];
    currentFolder: string;
    models: ModelProfile[];
}

export const DEFAULT_MODELS: ModelProfile[] = [
    { id: 'sdxl', name: 'SDXL', snap: '64' },
    { id: 'flux', name: 'Flux', snap: '16' },
];

export const DEFAULT_FOLDERS = [
    'General',
    'Merchandise',
    'Comics',
    'Etsy',
    'Redbubble',
];

export const DEFAULT_SETTINGS: MyPluginSettings = {
    dpi: 300,
    mode: 'pixels',
    round: true,
    oldWidth: 1024,
    oldHeight: 768,
    newWidth: 768,
    newHeight: 576,
    printWidthIn: 18,
    printHeightIn: 24,
    lastChanged: 'width',
    presets: [],
    folders: DEFAULT_FOLDERS,
    currentFolder: 'General',
    models: DEFAULT_MODELS,
};

export class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    newModelName = '';
    newModelSnap: SnapMode = '8';

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Print DPI')
            .setDesc('Used for inches, centimeters, and millimeters.')
            .addText((text) => {
                text.inputEl.type = 'number';
                text.setValue(String(this.plugin.settings.dpi));
                text.onChange(async (value) => {
                    this.plugin.settings.dpi = Number(value) || 300;
                    await this.plugin.saveSettings();
                });
            });

        containerEl.createEl('h3', { text: 'Models' });

        for (const model of this.plugin.settings.models) {
            new Setting(containerEl)
                .setName(model.name)
                .setDesc('Snap ' + model.snap)
                .addDropdown((dropdown) => {
                    dropdown.addOption('off', 'Off');
                    dropdown.addOption('8', '8');
                    dropdown.addOption('16', '16');
                    dropdown.addOption('32', '32');
                    dropdown.addOption('64', '64');
                    dropdown.setValue(model.snap);
                    dropdown.onChange(async (value) => {
                        model.snap = value as SnapMode;
                        await this.plugin.saveSettings();
                    });
                })
                .addButton((button) => {
                    button.setButtonText('Remove');
                    button.onClick(async () => {
                        this.plugin.settings.models =
                            this.plugin.settings.models.filter((item) => item.id !== model.id);
                        if (this.plugin.settings.mode === model.id) {
                            this.plugin.settings.mode = 'pixels';
                        }
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });
        }

        new Setting(containerEl)
            .setName('Add model')
            .addText((text) => {
                text.setPlaceholder('Flux 2, SD3, HiDream...');
                text.setValue(this.newModelName);
                text.onChange((value) => {
                    this.newModelName = value;
                });
            })
            .addDropdown((dropdown) => {
                dropdown.addOption('8', 'Snap 8');
                dropdown.addOption('16', 'Snap 16');
                dropdown.addOption('32', 'Snap 32');
                dropdown.addOption('64', 'Snap 64');
                dropdown.setValue(this.newModelSnap);
                dropdown.onChange((value) => {
                    this.newModelSnap = value as SnapMode;
                });
            })
            .addButton((button) => {
                button.setButtonText('Add').setCta();
                button.onClick(async () => {
                    const name = this.newModelName.trim();
                    if (!name) return;
                    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    if (['pixels', 'inches', 'cm', 'mm'].includes(id)) return;
                    this.plugin.settings.models.push({
                        id,
                        name,
                        snap: this.newModelSnap,
                    });
                    this.newModelName = '';
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
    }
}