import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type FpSelectValue = string | number | boolean | null;

export interface FpSelectOption {
    value: FpSelectValue;
    label: string;
    disabled?: boolean;
}

@Component({
    selector: 'app-fp-select',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './fp-select.html',
    styleUrls: ['./fp-select.scss'],
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => FpSelectComponent), multi: true }]
})
export class FpSelectComponent implements ControlValueAccessor {
    @Input() options: FpSelectOption[] = [];
    @Input() value: FpSelectValue = null;
    @Input() disabled = false;
    @Input() placeholder = 'Sélectionner';
    @Input() icon = 'tune';
    @Input() ariaLabel = 'Sélection';
    @Output() valueChange = new EventEmitter<FpSelectValue>();

    open = false;
    activeIndex = 0;
    private onChange: (value: FpSelectValue) => void = () => undefined;
    private onTouched: () => void = () => undefined;

    constructor(private elementRef: ElementRef<HTMLElement>) {}

    get selectedLabel(): string {
        return this.options.find(option => option.value === this.value)?.label || this.placeholder;
    }

    toggle(): void {
        if (this.disabled) return;
        this.open = !this.open;
        if (this.open) {
            const selectedIndex = this.options.findIndex(option => option.value === this.value && !option.disabled);
            this.activeIndex = selectedIndex >= 0 ? selectedIndex : this.firstEnabledIndex();
        }
        this.onTouched();
    }

    choose(option: FpSelectOption): void {
        if (option.disabled) return;
        this.value = option.value;
        this.valueChange.emit(option.value);
        this.onChange(option.value);
        this.onTouched();
        this.open = false;
    }

    onKeydown(event: KeyboardEvent): void {
        if (this.disabled) return;
        if (event.key === 'Escape') {
            this.open = false;
            return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!this.open) this.toggle();
            else if (this.options[this.activeIndex]) this.choose(this.options[this.activeIndex]);
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!this.open) this.toggle();
            else this.moveActive(event.key === 'ArrowDown' ? 1 : -1);
        }
    }

    writeValue(value: FpSelectValue): void { this.value = value; }
    registerOnChange(fn: (value: FpSelectValue) => void): void { this.onChange = fn; }
    registerOnTouched(fn: () => void): void { this.onTouched = fn; }
    setDisabledState(disabled: boolean): void { this.disabled = disabled; }

    @HostListener('document:click', ['$event'])
    closeOutside(event: Event): void {
        if (!this.elementRef.nativeElement.contains(event.target as Node)) this.open = false;
    }

    private moveActive(direction: number): void {
        if (!this.options.length) return;
        let index = this.activeIndex;
        for (let attempts = 0; attempts < this.options.length; attempts++) {
            index = (index + direction + this.options.length) % this.options.length;
            if (!this.options[index].disabled) {
                this.activeIndex = index;
                return;
            }
        }
    }

    private firstEnabledIndex(): number {
        const index = this.options.findIndex(option => !option.disabled);
        return index >= 0 ? index : 0;
    }
}
