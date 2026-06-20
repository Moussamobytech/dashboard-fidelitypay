import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { DeveloperService, ApiKey, WebhookEndpoint } from '../../core/services/developer.service';
import { PaymentService } from '../../core/services/payment.service';
import { MerchantProviderAccount, PaymentProvider, PaymentProviderService, PaymentRouteSetting } from '../../core/services/payment-provider.service';
import { Payment, PaymentStatus } from '../../core/models/payment.model';
import { AuthService } from '../../core/services/auth.service';

interface ProviderCredentialField {
    key: string;
    label: string;
    required?: boolean;
}

interface ProviderAccountForm {
    providerId: number | null;
    environment: 'SANDBOX' | 'LIVE';
    credentials: Record<string, string>;
}

@Component({
    selector: 'app-developers',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './developers.html',
    styleUrls: ['./developers.scss']
})
export class DevelopersComponent implements OnInit {
    private developerService = inject(DeveloperService);
    private paymentService = inject(PaymentService);
    private authService = inject(AuthService);
    private paymentProviderService = inject(PaymentProviderService);
    private router = inject(Router);

    allKeys = signal<ApiKey[]>([]);
    webhookUrl = signal('');
    webhookStatusMessage = signal('');
    createdWebhookSecret = signal<string | null>(null);
    isSavingWebhook = signal(false);
    isEditingWebhook = signal(false);
    providers = signal<PaymentProvider[]>([]);
    providerAccounts = signal<MerchantProviderAccount[]>([]);
    paymentRoutes = signal<PaymentRouteSetting[]>([]);
    isProviderModalOpen = signal(false);
    isProviderMenuOpen = signal(false);
    providerFormError = signal<string | null>(null);
    providerActionMessage = signal<string | null>(null);
    isSavingProviderAccount = signal(false);
    deletingProviderAccountId = signal<number | null>(null);
    providerAccountPendingDeletion = signal<MerchantProviderAccount | null>(null);
    recentPayments = signal<Payment[]>([]);
    webhookConfigured = signal(false);
    providerAccountForm: ProviderAccountForm = {
        providerId: null,
        environment: 'SANDBOX',
        credentials: {}
    };
    providerCredentialFields: ProviderCredentialField[] = [];
    providerEnvironmentChoices: Array<'SANDBOX' | 'LIVE'> = [];
    private paymentEvents = [
        'payment.success',
        'payment.failed',
        'payment.cancelled',
        'payment.requires_action',
        'payment.reconciliation'
    ];
    private existingPaymentWebhooks: WebhookEndpoint[] = [];

    providerRows = computed(() => this.providers().map(provider => {
        const accounts = this.providerAccounts()
            .filter(account => account.providerId === provider.id)
            .sort((a, b) => this.environmentOrder(a.environment) - this.environmentOrder(b.environment));
        return {
            provider,
            accounts,
            environments: accounts.map(account => this.formatEnvironment(account.environment)).join(' + ') || '-',
            enabledCount: accounts.filter(account => account.enabled).length,
            routeCount: this.paymentRoutes().filter(route => route.providerId === provider.id && route.platformEnabled).length
        };
    }));

    configuredProvidersCount = computed(() => this.providerRows().filter(row => row.accounts.length > 0).length);
    activeProvidersCount = computed(() => this.providers().length);
    canAddNewProviderAccount = computed(() => this.providerRows().some(row => row.accounts.length === 0));
    hasActiveKey = computed(() => this.allKeys().some(key => key.isActive));
    hasEnabledProvider = computed(() => this.providerAccounts().some(account => account.enabled));
    hasSuccessfulDashboardTest = computed(() => this.recentPayments().some(payment =>
        payment.initiationSource === 'DASHBOARD' && payment.status === PaymentStatus.SUCCESS
    ));
    integrationCompletedCount = computed(() => [
        this.hasActiveKey(),
        this.hasEnabledProvider(),
        this.webhookConfigured(),
        this.hasSuccessfulDashboardTest()
    ].filter(Boolean).length);
    integrationReadyForApi = computed(() => this.integrationCompletedCount() === 4);
    providerSetupSummary = computed(() => {
        const total = this.activeProvidersCount();
        const configured = this.configuredProvidersCount();
        const liveCount = this.providerAccounts().filter(account => account.environment.toUpperCase() === 'LIVE' && account.enabled).length;
        const sandboxCount = this.providerAccounts().filter(account => account.environment.toUpperCase() === 'SANDBOX' && account.enabled).length;
        if (configured === 0) {
            return `0/${total} partenaires configurés.`;
        }
        return `${configured}/${total} partenaires configurés · Live: ${liveCount} · Sandbox: ${sandboxCount}`;
    });

    // Stats as signals for reactivity
    activeKeysCount = signal(0);
    apiCallsCount = signal(0);
    successRate = signal(0);
    avgLatency = signal(0);
    isAdmin = computed<boolean>(() => this.authService.isAdmin());

    ngOnInit(): void {
        const obs = this.isAdmin()
            ? this.developerService.getAllKeysAdmin()
            : this.developerService.getKeys();

        obs.subscribe(keys => {
            const visibleKeys = this.isAdmin() ? keys : keys.filter(key => key.isActive);
            this.allKeys.set(visibleKeys);
            this.activeKeysCount.set(visibleKeys.filter(key => key.isActive).length);
        });

        if (!this.isAdmin()) {
            this.loadPaymentWebhooks();
            this.loadProviderSetup();
        }

        this.loadTransactionStats();
    }


    loadTransactionStats(): void {
        this.paymentService.getRecentPayments().subscribe({
            next: (payments: Payment[]) => {
                this.recentPayments.set(payments || []);
                if (!payments || payments.length === 0) return;

                const total = payments.length;
                const success = payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
                const latencies = payments
                    .map(p => p.providerResponseTimeMs || (p as any).latency || 0)
                    .filter(l => l > 0);

                const avg = latencies.length > 0
                    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                    : 0;

                this.apiCallsCount.set(total);
                this.successRate.set(total > 0 ? Number((success / total * 100).toFixed(1)) : 0);
                this.avgLatency.set(Math.round(avg));
            },
            error: (err) => console.error('Error loading developer stats:', err)
        });
    }

    copyToClipboard(text: string): void {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copié dans le presse-papier !');
        });
    }

    loadPaymentWebhooks(): void {
        this.developerService.getWebhooks().subscribe({
            next: (webhooks) => {
                this.existingPaymentWebhooks = webhooks.filter(w => this.paymentEvents.includes(w.event));
                const active = this.existingPaymentWebhooks.find(w => w.isActive);
                this.webhookUrl.set(active?.url || '');
                this.webhookConfigured.set(Boolean(active));
                this.isEditingWebhook.set(false);
            },
            error: () => this.webhookStatusMessage.set('Impossible de charger le webhook marchand pour le moment.')
        });
    }

    updateWebhookUrl(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.webhookUrl.set(input.value);
    }

    saveWebhookSettings(): void {
        const url = this.webhookUrl().trim();
        if (!this.isPublicWebhookUrl(url)) {
            this.webhookStatusMessage.set('Utilisez une URL HTTPS publique. Les adresses localhost, .local et les réseaux privés ne peuvent pas recevoir les notifications FidelityPay.');
            return;
        }

        this.isSavingWebhook.set(true);
        this.webhookStatusMessage.set('');
        this.createdWebhookSecret.set(null);

        const outdated = this.existingPaymentWebhooks.filter(w => w.url !== url);
        const existingForUrl = this.existingPaymentWebhooks.filter(w => w.url === url);
        const missingEvents = this.paymentEvents.filter(event => !existingForUrl.some(w => w.event === event));
        const deleteCalls = outdated.map(w => this.developerService.deleteWebhook(w.id));
        const deletePhase = deleteCalls.length ? forkJoin(deleteCalls) : of([]);

        deletePhase.pipe(
            switchMap(() => {
                const createCalls = missingEvents.map(event => this.developerService.createWebhook({
                    url,
                    event,
                    description: `Notification ${event}`
                }));
                const activateCalls = existingForUrl
                    .filter(w => !w.isActive)
                    .map(w => this.developerService.setWebhookActive(w.id, true));
                const calls = [...createCalls, ...activateCalls];
                return calls.length ? forkJoin(calls) : of([] as WebhookEndpoint[]);
            }),
            switchMap((responses) => {
                const webhookSecret = responses.find(response => response.secret)?.secret;
                if (webhookSecret) {
                    this.createdWebhookSecret.set(webhookSecret);
                }
                return this.developerService.getWebhooks();
            }),
        ).subscribe({
            next: (webhooks) => {
                this.existingPaymentWebhooks = webhooks.filter(w => this.paymentEvents.includes(w.event));
                this.webhookConfigured.set(this.existingPaymentWebhooks.some(w => w.isActive));
                this.isEditingWebhook.set(false);
                this.webhookStatusMessage.set('Webhook enregistré. Vérifiez maintenant que cette URL est publique, joignable depuis Internet et accepte les requêtes POST HTTPS de FidelityPay.');
                this.isSavingWebhook.set(false);
            },
            error: () => {
                this.webhookStatusMessage.set('Échec de la sauvegarde du webhook.');
                this.isSavingWebhook.set(false);
            }
        });
    }

    editWebhook(): void {
        this.webhookStatusMessage.set('');
        this.isEditingWebhook.set(true);
    }

    cancelWebhookEdit(): void {
        const active = this.existingPaymentWebhooks.find(webhook => webhook.isActive);
        this.webhookUrl.set(active?.url || '');
        this.webhookStatusMessage.set('');
        this.isEditingWebhook.set(false);
    }

    private isPublicWebhookUrl(value: string): boolean {
        try {
            const url = new URL(value);
            const host = url.hostname.toLowerCase();
            if (url.protocol !== 'https:' || !host || host === 'localhost'
                || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
                return false;
            }
            const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
            if (!match) return true;
            const first = Number(match[1]);
            const second = Number(match[2]);
            return !(first === 0 || first === 10 || first === 127 || first >= 224
                || (first === 169 && second === 254)
                || (first === 172 && second >= 16 && second <= 31)
                || (first === 192 && second === 168));
        } catch {
            return false;
        }
    }

    loadProviderSetup(): void {
        forkJoin({
            providers: this.paymentProviderService.getPaymentProviders(false),
            accounts: this.paymentProviderService.getProviderAccounts(),
            routes: this.paymentProviderService.getPaymentRoutes(false)
        }).subscribe({
            next: ({ providers, accounts, routes }) => {
                this.providers.set(providers || []);
                this.providerAccounts.set(accounts || []);
                this.paymentRoutes.set(routes || []);
            },
            error: () => {
                this.providerActionMessage.set('Impossible de charger la configuration des agrégateurs.');
            }
        });
    }

    openProviderAccountModal(provider?: PaymentProvider, environment?: 'SANDBOX' | 'LIVE'): void {
        const targetProvider = provider || this.providerRows().find(row => row.accounts.length === 0)?.provider || this.providers()[0];
        if (!targetProvider) {
            return;
        }
        const selectedEnvironment = environment || this.firstMissingEnvironment(targetProvider.id) || 'SANDBOX';
        this.providerAccountForm = {
            providerId: targetProvider.id,
            environment: selectedEnvironment,
            credentials: {}
        };
        this.refreshProviderModalFields();
        this.providerFormError.set(null);
        this.providerActionMessage.set(null);
        this.isProviderModalOpen.set(true);
    }

    closeProviderAccountModal(): void {
        if (!this.isSavingProviderAccount()) {
            this.isProviderMenuOpen.set(false);
            this.isProviderModalOpen.set(false);
        }
    }

    toggleProviderMenu(): void {
        this.isProviderMenuOpen.update(open => !open);
    }

    chooseProvider(provider: PaymentProvider): void {
        this.selectProviderForAccount(provider.id);
        this.isProviderMenuOpen.set(false);
    }

    selectProviderForAccount(providerId: number): void {
        this.providerAccountForm.providerId = Number(providerId);
        this.providerAccountForm.credentials = {};
        const environment = this.firstMissingEnvironment(Number(providerId));
        if (environment) {
            this.providerAccountForm.environment = environment;
        }
        this.refreshProviderModalFields();
    }

    saveProviderAccount(): void {
        const providerId = this.providerAccountForm.providerId;
        if (!providerId) {
            this.providerFormError.set('Choisissez un agrégateur.');
            return;
        }
        const provider = this.providers().find(item => item.id === Number(providerId));
        const missingRequired = this.credentialFields(provider).some(field =>
            field.required && !this.providerAccountForm.credentials[field.key]?.trim()
        );
        if (missingRequired) {
            this.providerFormError.set('Renseignez toutes les clés obligatoires.');
            return;
        }

        this.isSavingProviderAccount.set(true);
        this.providerFormError.set(null);
        this.paymentProviderService.upsertProviderAccount({
            providerId: Number(providerId),
            environment: this.providerAccountForm.environment,
            enabled: true,
            credentials: this.providerAccountForm.credentials
        }).subscribe({
            next: () => {
                this.isSavingProviderAccount.set(false);
                this.isProviderModalOpen.set(false);
                this.providerActionMessage.set('Agrégateur enregistré.');
                this.loadProviderSetup();
            },
            error: () => {
                this.providerFormError.set('Impossible d’enregistrer cet agrégateur.');
                this.isSavingProviderAccount.set(false);
            }
        });
    }

    requestProviderAccountDeletion(account: MerchantProviderAccount): void {
        this.providerActionMessage.set(null);
        this.providerAccountPendingDeletion.set(account);
    }

    cancelProviderAccountDeletion(): void {
        if (!this.deletingProviderAccountId()) {
            this.providerAccountPendingDeletion.set(null);
        }
    }

    confirmProviderAccountDeletion(): void {
        const account = this.providerAccountPendingDeletion();
        if (!account) {
            return;
        }
        this.deletingProviderAccountId.set(account.id);
        this.paymentProviderService.deleteProviderAccount(account.id).subscribe({
            next: () => {
                this.deletingProviderAccountId.set(null);
                this.providerAccountPendingDeletion.set(null);
                this.providerActionMessage.set('Agrégateur supprimé.');
                this.loadProviderSetup();
            },
            error: (error) => {
                this.deletingProviderAccountId.set(null);
                this.providerActionMessage.set(
                    error?.error?.message || error?.error?.error || 'Impossible de supprimer cet agrégateur.'
                );
            }
        });
    }

    openProviderRoutes(providerId: number): void {
        this.router.navigate(['/developers/providers', providerId, 'routes']);
    }

    scrollToSection(sectionId: string): void {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    accountFor(providerId: number, environment: string): MerchantProviderAccount | undefined {
        return this.providerAccounts().find(account =>
            account.providerId === providerId && account.environment.toUpperCase() === environment.toUpperCase()
        );
    }

    private availableProviderEnvironments(providerId: number | null): Array<'SANDBOX' | 'LIVE'> {
        const environments: Array<'SANDBOX' | 'LIVE'> = ['SANDBOX', 'LIVE'];
        if (!providerId) {
            return environments;
        }
        const existing = this.providerAccounts()
            .filter(account => account.providerId === Number(providerId))
            .map(account => account.environment.toUpperCase());
        const available = environments.filter(env =>
            !existing.includes(env) || env === this.providerAccountForm.environment
        );
        return available.length ? available : environments;
    }

    credentialFields(provider?: PaymentProvider): ProviderCredentialField[] {
        if (!provider?.credentialSchema) {
            return [
                { key: 'publicKey', label: 'Public Key', required: true },
                { key: 'privateKey', label: 'Private Key', required: true },
                { key: 'token', label: 'Token', required: false }
            ];
        }
        try {
            const parsed = JSON.parse(provider.credentialSchema);
            return Array.isArray(parsed.fields) ? parsed.fields : [];
        } catch {
            return [];
        }
    }

    selectedProviderForForm(): PaymentProvider | undefined {
        return this.providers().find(provider => provider.id === Number(this.providerAccountForm.providerId));
    }

    private refreshProviderModalFields(): void {
        this.providerCredentialFields = this.credentialFields(this.selectedProviderForForm());
        this.providerEnvironmentChoices = this.availableProviderEnvironments(this.providerAccountForm.providerId);
        if (!this.providerEnvironmentChoices.includes(this.providerAccountForm.environment)) {
            this.providerAccountForm.environment = this.providerEnvironmentChoices[0] || 'SANDBOX';
        }
    }

    formatEnvironment(environment?: string): string {
        return environment?.toUpperCase() === 'SANDBOX' ? 'Sandbox' : 'Live';
    }

    private firstMissingEnvironment(providerId: number): 'SANDBOX' | 'LIVE' | null {
        const existing = this.providerAccounts()
            .filter(account => account.providerId === providerId)
            .map(account => account.environment.toUpperCase());
        if (!existing.includes('SANDBOX')) {
            return 'SANDBOX';
        }
        if (!existing.includes('LIVE')) {
            return 'LIVE';
        }
        return null;
    }

    private environmentOrder(environment?: string): number {
        return environment?.toUpperCase() === 'LIVE' ? 1 : 0;
    }
}
