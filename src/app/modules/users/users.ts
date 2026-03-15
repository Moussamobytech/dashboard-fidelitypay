import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User, UserUpdateRequest } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './users.html',
    styleUrls: ['./users.scss']
})
export class UsersComponent implements OnInit {
    private userService = inject(UserService);
    public authService = inject(AuthService);

    users = signal<User[]>([]);
    viewMode = signal<'list' | 'grid'>('list');
    searchTerm = signal('');

    // Editing state
    editingUser = signal<User | null>(null);
    editForm = signal<UserUpdateRequest>({});
    editCountriesStr = signal('');

    // Formatting date
    Math = Math;

    filteredUsers = computed(() => {
        const term = this.searchTerm().toLowerCase();
        if (!term) return this.users();
        return this.users().filter(u => 
            u.fullName.toLowerCase().includes(term) ||
            u.email.toLowerCase().includes(term) ||
            u.role.toLowerCase().includes(term)
        );
    });

    ngOnInit() {
        this.loadUsers();
    }

    loadUsers() {
        this.userService.getAllUsers().subscribe({
            next: (data) => this.users.set(data),
            error: (err) => console.error('Erreur chargement utilisateurs:', err)
        });
    }

    setViewMode(mode: 'list' | 'grid') {
        this.viewMode.set(mode);
    }

    getInitials(name: string): string {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2) || 'U';
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    startEdit(user: User) {
        this.editingUser.set(user);
        this.editCountriesStr.set(user.countries ? user.countries.join(', ') : '');
        this.editForm.set({
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            applicationName: user.applicationName
        });
    }

    cancelEdit() {
        this.editingUser.set(null);
        this.editForm.set({});
    }

    saveEdit() {
        const user = this.editingUser();
        if (!user) return;
        
        const updateData = { ...this.editForm() };
        const cStr = this.editCountriesStr().trim();
        updateData.countries = cStr ? cStr.split(',').map(c => c.trim()).filter(c => c) : [];
        
        this.userService.updateUser(user.id, updateData).subscribe({
            next: (updated) => {
                this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
                this.cancelEdit();
            },
            error: (err) => {
                console.error('Erreur de mise à jour:', err);
                alert("Erreur: " + (err.error?.message || err.message));
            }
        });
    }

    toggleUserStatus(user: User) {
        const newStatus = !user.isActive;
        this.userService.updateUser(user.id, { isActive: newStatus }).subscribe({
            next: (updated) => {
                this.users.update(list => list.map(u => u.id === user.id ? { ...u, isActive: newStatus } : u));
            },
            error: (err) => {
                console.error('Erreur de mise à jour du statut:', err);
                alert("Erreur lors de la mise à jour du statut.");
            }
        });
    }

    deleteUser(user: User) {
        if (!confirm(`Toutes les données de ${user.fullName} seront perdues. Voulez-vous vraiment supprimer cet utilisateur ?`)) {
            return;
        }

        this.userService.deleteUser(user.id).subscribe({
            next: () => {
                this.users.update(list => list.filter(u => u.id !== user.id));
            },
            error: (err) => {
                console.error('Erreur suppression:', err);
                alert("Erreur lors de la suppression");
            }
        });
    }
}
