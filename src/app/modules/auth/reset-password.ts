import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './reset-password.html',
    styleUrls: ['./register.scss'] // Réutilisation du style
})
export class ResetPasswordComponent implements OnInit {
    private fb = inject(FormBuilder);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private authService = inject(AuthService);

    token: string | null = null;
    isLoading = signal(false);
    isSuccess = signal(false);
    errorMessage = signal<string | null>(null);

    resetForm = this.fb.group({
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    ngOnInit() {
        this.token = this.route.snapshot.queryParamMap.get('token');
        if (!this.token) {
            this.errorMessage.set('Jeton de réinitialisation manquant ou invalide.');
        }
    }

    passwordMatchValidator(g: any) {
        return g.get('password').value === g.get('confirmPassword').value
            ? null : { 'mismatch': true };
    }

    onSubmit() {
        if (this.resetForm.valid && this.token) {
            this.isLoading.set(true);
            this.errorMessage.set(null);

            const newPassword = this.resetForm.value.password!;

            this.authService.resetPassword(this.token, newPassword).subscribe({
                next: () => {
                    this.isLoading.set(false);
                    this.isSuccess.set(true);
                },
                error: (err) => {
                    this.isLoading.set(false);
                    this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de la réinitialisation.');
                }
            });
        } else {
            this.resetForm.markAllAsTouched();
        }
    }

    goToLogin() {
        this.router.navigate(['/login']);
    }
}
