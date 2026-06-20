import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ApiKey, DeveloperService } from '../../../core/services/developer.service';

@Component({
    selector: 'app-api-keys',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './api-keys.html',
    styleUrls: ['./api-keys.scss']
})
export class ApiKeysComponent implements OnInit {
    private developerService = inject(DeveloperService);
    private authService = inject(AuthService);

    keys = signal<ApiKey[]>([]);
    createdKey = signal<ApiKey | null>(null);
    isCreating = signal(false);
    deletingKeyId = signal<string | null>(null);
    renamingKeyId = signal<string | null>(null);
    editingKeyId = signal<string | null>(null);
    errorMessage = signal<string | null>(null);
    isAdmin = computed(() => this.authService.isAdmin());
    keyName = '';
    editingName = '';

    ngOnInit(): void {
        const source = this.isAdmin()
            ? this.developerService.getAllKeysAdmin()
            : this.developerService.getKeys();
        source.subscribe({
            next: keys => this.keys.set(keys.filter(key => key.isActive)),
            error: () => this.errorMessage.set('Impossible de charger les clés API.')
        });
    }

    createKey(): void {
        const name = this.keyName.trim();
        if (!name || this.isAdmin()) return;

        this.isCreating.set(true);
        this.errorMessage.set(null);
        this.developerService.createKey(name).subscribe({
            next: key => {
                const maskedKey = { ...key, apiKey: undefined };
                this.developerService.addKeyToState(maskedKey);
                this.keys.update(keys => [...keys.filter(item => item.id !== key.id), maskedKey]);
                this.createdKey.set(key);
                this.keyName = '';
                this.isCreating.set(false);
            },
            error: error => {
                this.errorMessage.set(error.error?.message || error.error?.error || 'Impossible de créer la clé API.');
                this.isCreating.set(false);
            }
        });
    }

    deleteKey(key: ApiKey): void {
        if (!confirm(`Supprimer la clé « ${key.name} » ? Cette action est irréversible.`)) return;

        this.deletingKeyId.set(key.id);
        this.errorMessage.set(null);
        const request = this.isAdmin()
            ? this.developerService.adminDeleteKey(key.id)
            : this.developerService.deleteKey(key.id);
        request.subscribe({
            next: () => {
                this.keys.update(keys => keys.filter(item => item.id !== key.id));
                if (this.createdKey()?.id === key.id) this.createdKey.set(null);
                if (this.editingKeyId() === key.id) this.cancelRename();
                this.deletingKeyId.set(null);
            },
            error: error => {
                this.errorMessage.set(error.error?.message || error.error?.error || 'Impossible de supprimer cette clé.');
                this.deletingKeyId.set(null);
            }
        });
    }

    startRename(key: ApiKey): void {
        this.editingKeyId.set(key.id);
        this.editingName = key.name;
    }

    cancelRename(): void {
        this.editingKeyId.set(null);
        this.editingName = '';
        this.renamingKeyId.set(null);
    }

    saveRename(key: ApiKey): void {
        const name = this.editingName.trim();
        if (name.length < 3) {
            this.errorMessage.set('Le nom doit contenir au moins 3 caractères.');
            return;
        }
        this.renamingKeyId.set(key.id);
        this.developerService.renameKey(key.id, name).subscribe({
            next: updated => {
                this.keys.update(keys => keys.map(item => item.id === key.id ? updated : item));
                this.cancelRename();
            },
            error: () => {
                this.errorMessage.set('Impossible de renommer cette clé.');
                this.renamingKeyId.set(null);
            }
        });
    }

    closeCreatedKey(): void {
        this.createdKey.set(null);
    }

    copy(value?: string): void {
        if (value) navigator.clipboard.writeText(value);
    }
}
