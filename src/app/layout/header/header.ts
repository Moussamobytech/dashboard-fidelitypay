import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './header.html',
    styleUrls: ['./header.scss']
})
export class HeaderComponent {
    @Output() toggleSidebar = new EventEmitter<void>();
    currentDate = new Date();

    onToggle() {
        this.toggleSidebar.emit();
    }
}
