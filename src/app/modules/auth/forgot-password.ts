import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    selector: 'app-forgot-password',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './forgot-password.html',
    styleUrls: ['./register.scss']
})
export class ForgotPasswordComponent {
    private fb = inject(FormBuilder);
    private router = inject(Router);

    isLoading = signal(false);
    isSuccess = signal(false);
    errorMessage = signal<string | null>(null);

    forgotForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]]
    });

    onSubmit() {
        if (this.forgotForm.valid) {
            this.isLoading.set(true);
            this.errorMessage.set(null);

            // Simule un appel backend pour l'envoi de l'email
            setTimeout(() => {
                this.isLoading.set(false);
                this.isSuccess.set(true);
            }, 1500);
        } else {
            this.forgotForm.markAllAsTouched();
        }
    }

    backToLogin() {
        this.router.navigate(['/login']);
    }
}
