import { MarkdownView, Modal, Notice, Plugin, Setting, setIcon } from 'obsidian';
import {
    DEFAULT_FOLDERS,
    DEFAULT_MODELS,
    DEFAULT_SETTINGS,
    ModelProfile,
    MyPluginSettings,
    SampleSettingTab,
    SnapMode,
} from './settings';

export default class MyPlugin extends Plugin {
    settings!: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('scan', 'Aspect Ratio Calculator', () => {
            new AspectRatioModal(this).open();
        });

        this.addCommand({
            id: 'open-aspect-ratio-calculator',
            name: 'Open aspect ratio calculator',
            callback: () => {
                new AspectRatioModal(this).open();
            },
        });

        this.addSettingTab(new SampleSettingTab(this.app, this));
    }

    onunload() {}

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            (await this.loadData()) as Partial<MyPluginSettings>,
        );
        if (!this.settings.presets) this.settings.presets = [];
        if (!this.settings.models) this.settings.models = DEFAULT_MODELS;
        if (!this.settings.folders || this.settings.folders.length === 0) {
            this.settings.folders = DEFAULT_FOLDERS.slice();
        }
        if (!this.settings.currentFolder) this.settings.currentFolder = 'General';
        if (!this.settings.printWidthIn) this.settings.printWidthIn = 18;
        if (!this.settings.printHeightIn) this.settings.printHeightIn = 24;
        for (const preset of this.settings.presets) {
            if (!preset.folder) preset.folder = 'General';
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class AspectRatioModal extends Modal {
    plugin: MyPlugin;
    oldWidthEl!: HTMLInputElement;
    oldHeightEl!: HTMLInputElement;
    targetWidthEl!: HTMLInputElement;
    targetHeightEl!: HTMLInputElement;
    ratioEl!: HTMLElement;

    constructor(plugin: MyPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    s() {
        return this.plugin.settings;
    }

    onOpen() {
        this.setTitle('Aspect Ratio Calculator');
        this.draw();
    }

    onClose() {
        void this.plugin.saveSettings();
        this.contentEl.empty();
    }

    isPhysicalMode() {
        return ['inches', 'cm', 'mm'].includes(this.s().mode);
    }

    unitLabel() {
        if (this.s().mode === 'cm') return 'cm';
        if (this.s().mode === 'mm') return 'mm';
        if (this.s().mode === 'inches') return 'in';
        return 'px';
    }

    fromInches(inches: number): number {
        if (this.s().mode === 'cm') return inches * 2.54;
        if (this.s().mode === 'mm') return inches * 25.4;
        return inches;
    }

    toInches(value: number): number {
        if (this.s().mode === 'cm') return value / 2.54;
        if (this.s().mode === 'mm') return value / 25.4;
        return value;
    }

    currentModel(): ModelProfile | null {
        return this.s().models.find((model) => model.id === this.s().mode) ?? null;
    }

    snapStep(): number {
        const model = this.currentModel();
        const snap: SnapMode = model ? model.snap : 'off';
        if (snap === 'off') return 0;
        return Number(snap);
    }

    snap(value: number): number {
        const step = this.snapStep();
        if (value <= 0) return 0;
        if (step <= 0) return this.s().round ? Math.round(value) : value;
        return Math.round(value / step) * step;
    }

    printPixels() {
        const dpi = this.s().dpi || 300;
        return {
            width: Math.round(this.s().printWidthIn * dpi),
            height: Math.round(this.s().printHeightIn * dpi),
        };
    }

    gcd(a: number, b: number): number {
        a = Math.round(Math.abs(a));
        b = Math.round(Math.abs(b));
        while (b) {
            const t = b;
            b = a % b;
            a = t;
        }
        return a || 1;
    }

    ratioText(width: number, height: number): string {
        if (width <= 0 || height <= 0) return '—';
        const divisor = this.gcd(width, height);
        return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
    }

    targetSize() {
        const s = this.s();
        if (this.isPhysicalMode()) return this.printPixels();

        const sourceW = s.oldWidth || 1;
        const sourceH = s.oldHeight || 1;
        let width = s.newWidth;
        let height = s.newHeight;

        if (s.lastChanged === 'width') {
            height = (sourceH / sourceW) * width;
        } else {
            width = (sourceW / sourceH) * height;
        }

        width = this.snap(width);
        height = this.snap((sourceH / sourceW) * width);
        return { width, height };
    }

    resultText() {
        const size = this.targetSize();
        return `${size.width}x${size.height}`;
    }

    makeNumberInput(parent: HTMLElement, value: string): HTMLInputElement {
        const input = parent.createEl('input');
        input.type = 'number';
        input.value = value;
        input.addClass('aspect-number');
        return input;
    }

    draw() {
        const { contentEl } = this;
        contentEl.empty();
        const s = this.s();

        const originalBox = contentEl.createDiv({ cls: 'aspect-original' });

        const widthRow = originalBox.createDiv({ cls: 'aspect-row' });
        widthRow.createEl('label', { text: 'Original width' });
        this.oldWidthEl = this.makeNumberInput(widthRow, String(s.oldWidth));
        this.oldWidthEl.addEventListener('input', () => {
            s.oldWidth = Number(this.oldWidthEl.value) || 0;
            this.refreshOutputs();
        });

        const swapRow = originalBox.createDiv({ cls: 'aspect-swap-row' });
        const swapButton = swapRow.createEl('button', { cls: 'aspect-swap' });
        setIcon(swapButton, 'arrow-up-down');
        swapButton.setAttribute('aria-label', 'Swap dimensions');
        swapButton.addEventListener('click', () => this.swapAll());

        const heightRow = originalBox.createDiv({ cls: 'aspect-row' });
        heightRow.createEl('label', { text: 'Original height' });
        this.oldHeightEl = this.makeNumberInput(heightRow, String(s.oldHeight));
        this.oldHeightEl.addEventListener('input', () => {
            s.oldHeight = Number(this.oldHeightEl.value) || 0;
            this.refreshOutputs();
        });

        new Setting(contentEl)
            .setName('Mode')
            .setDesc('Pixels and print units are sizes. SDXL / Flux / other models set generate snap.')
            .addDropdown((dropdown) => {
                dropdown.addOption('pixels', 'Pixels');
                dropdown.addOption('inches', 'Inches');
                dropdown.addOption('cm', 'Centimeters');
                dropdown.addOption('mm', 'Millimeters');
                for (const model of s.models) {
                    dropdown.addOption(model.id, model.name);
                }
                dropdown.setValue(s.mode);
                dropdown.onChange((value) => {
                    s.mode = value;
                    void this.plugin.saveSettings();
                    this.draw();
                });
            });

        const targetBox = contentEl.createDiv({ cls: 'aspect-original' });
        const targetWidthRow = targetBox.createDiv({ cls: 'aspect-row' });
        const targetHeightRow = targetBox.createDiv({ cls: 'aspect-row' });

        if (this.isPhysicalMode()) {
            const unit = this.unitLabel();
            targetWidthRow.createEl('label', { text: `Print width (${unit})` });
            this.targetWidthEl = this.makeNumberInput(
                targetWidthRow,
                String(this.roundDisplay(this.fromInches(s.printWidthIn))),
            );
            this.targetWidthEl.addEventListener('input', () => {
                s.printWidthIn = this.toInches(Number(this.targetWidthEl.value) || 0);
                s.lastChanged = 'width';
                this.refreshOutputs();
            });

            targetHeightRow.createEl('label', { text: `Print height (${unit})` });
            this.targetHeightEl = this.makeNumberInput(
                targetHeightRow,
                String(this.roundDisplay(this.fromInches(s.printHeightIn))),
            );
            this.targetHeightEl.addEventListener('input', () => {
                s.printHeightIn = this.toInches(Number(this.targetHeightEl.value) || 0);
                s.lastChanged = 'height';
                this.refreshOutputs();
            });

            new Setting(contentEl)
                .setName('DPI')
                .addText((text) => {
                    text.inputEl.type = 'number';
                    text.setValue(String(s.dpi));
                    text.onChange((value) => {
                        s.dpi = Number(value) || 300;
                        this.refreshOutputs();
                    });
                });
        } else {
            const model = this.currentModel();
            const label = model ? model.name + ' size' : 'Pixel size';
            targetWidthRow.createEl('label', { text: label + ' width' });
            this.targetWidthEl = this.makeNumberInput(targetWidthRow, String(s.newWidth));
            this.targetWidthEl.addEventListener('input', () => {
                s.newWidth = Number(this.targetWidthEl.value) || 0;
                s.lastChanged = 'width';
                this.refreshOutputs();
            });

            targetHeightRow.createEl('label', { text: label + ' height' });
            this.targetHeightEl = this.makeNumberInput(targetHeightRow, String(s.newHeight));
            this.targetHeightEl.addEventListener('input', () => {
                s.newHeight = Number(this.targetHeightEl.value) || 0;
                s.lastChanged = 'height';
                this.refreshOutputs();
            });
        }

        const resultRow = contentEl.createDiv({ cls: 'aspect-result-row' });
        this.ratioEl = resultRow.createEl('p', { cls: 'aspect-ratio-result' });

        const roundWrap = resultRow.createDiv({ cls: 'aspect-round' });
        roundWrap.createEl('span', { text: 'Round to whole pixels' });
        const roundToggle = roundWrap.createEl('input');
        roundToggle.type = 'checkbox';
        roundToggle.checked = s.round;
        roundToggle.addEventListener('change', () => {
            s.round = roundToggle.checked;
            this.refreshOutputs();
        });

        this.refreshOutputs();
    }

    roundDisplay(value: number): number {
        return Math.round(value * 1000) / 1000;
    }

    swapAll() {
        const s = this.s();

        const originalWidth = s.oldWidth;
        s.oldWidth = s.oldHeight;
        s.oldHeight = originalWidth;

        const pixelWidth = s.newWidth;
        s.newWidth = s.newHeight;
        s.newHeight = pixelWidth;

        const printWidth = s.printWidthIn;
        s.printWidthIn = s.printHeightIn;
        s.printHeightIn = printWidth;

        this.oldWidthEl.value = String(s.oldWidth);
        this.oldHeightEl.value = String(s.oldHeight);

        if (this.isPhysicalMode()) {
            this.targetWidthEl.value = String(this.roundDisplay(this.fromInches(s.printWidthIn)));
            this.targetHeightEl.value = String(this.roundDisplay(this.fromInches(s.printHeightIn)));
        } else {
            this.targetWidthEl.value = String(s.newWidth);
            this.targetHeightEl.value = String(s.newHeight);
        }

        s.lastChanged = 'width';
        this.refreshOutputs();
    }

    refreshOutputs() {
        const s = this.s();
        if (!this.isPhysicalMode()) {
            const target = this.targetSize();
            if (s.lastChanged === 'width') {
                s.newHeight = target.height;
                if (this.targetHeightEl) this.targetHeightEl.value = String(target.height);
            } else {
                s.newWidth = target.width;
                if (this.targetWidthEl) this.targetWidthEl.value = String(target.width);
            }
        }

        const model = this.currentModel();
        let extra = `  ·  ${this.resultText()}`;
        if (this.isPhysicalMode()) {
            extra = `  ·  ${this.resultText()} px @ ${s.dpi} DPI`;
        } else if (model) {
            extra = `  ·  ${this.resultText()}  (snap ${model.snap})`;
        }
        this.ratioEl.setText(`Ratio ${this.ratioText(s.oldWidth, s.oldHeight)}${extra}`);
        void this.plugin.saveSettings();
    }
}