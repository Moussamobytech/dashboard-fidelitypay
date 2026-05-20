import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgregateurService, Agregateur, CountryConfig, PaymentProvider, PaymentRouteSetting } from '../../core/services/agregateur.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-aggregators',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './aggregators.html',
  styleUrls: ['./aggregators.scss']
})
export class AggregatorsComponent implements OnInit {
  private agregateurService = inject(AgregateurService);
  private authService = inject(AuthService);

  viewMode = signal<'list' | 'grid'>('list');
  aggregators = signal<Agregateur[]>([]);
  paymentRoutes = signal<PaymentRouteSetting[]>([]);
  supportedProviders = signal<PaymentProvider[]>([]);
  isLoading = signal(false);

  showAddForm = signal(false);

  editingAggregator = signal<Agregateur | null>(null);
  viewingAggregator = signal<Agregateur | null>(null);
  isAdmin = this.authService.isAdmin;

  newAggregator = signal<Agregateur>(this.emptyAggregator());

  readonly westAfricanCountries = [
    'Bénin', 'Burkina Faso', 'Cameroun',
    'Côte d\'Ivoire', 'Niger',
    'Guinée', 'Mali', 'Sénégal', 'Togo'
  ];

  readonly defaultSupportedProviders = ['KKIAPAY', 'PAYDUNYA'];

  getOperatorsList(operators: string): string[] {
    return operators ? operators.split(',').map(s => s.trim()).filter(s => s) : [];
  }

  getTotalOperators(agg: Agregateur): number {
    if (!agg.countryConfigs) return 0;
    return agg.countryConfigs.reduce((acc, config) => acc + this.getOperatorsList(config.operators).length, 0);
  }

  // Lifecycle & API
  ngOnInit() {
    this.loadSupportedProviders();
    this.loadAggregators();
    this.loadPaymentRoutes();
  }

  loadSupportedProviders() {
    this.agregateurService.getPaymentProviders(this.isAdmin()).subscribe({
      next: providers => this.supportedProviders.set(providers),
      error: err => console.error('Erreur lors du chargement des providers', err)
    });
  }

  loadAggregators() {
    this.isLoading.set(true);
    if (this.isAdmin()) {
      this.agregateurService.getPaymentProviders(true).subscribe({
        next: (providers) => {
          this.supportedProviders.set(providers);
          this.aggregators.set(providers.map(provider => ({
            id: provider.id,
            providerId: provider.id,
            providerCode: provider.code,
            nomA: provider.displayName,
            displayName: provider.displayName,
            credentialSchema: provider.credentialSchema,
            cleApblic: '',
            cleApr: '',
            cleAtoken: '',
            nompays: '',
            nomOperateur: '',
            countryConfigs: [],
            enabled: provider.status === 'ACTIVE'
          })));
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Erreur lors du chargement des agrégateurs', err);
          this.isLoading.set(false);
        }
      });
      return;
    }
    this.agregateurService.getProviderAccounts().subscribe({
      next: (accounts) => {
        this.aggregators.set(accounts.map(account => ({
          id: account.id,
          providerId: account.providerId,
          providerCode: account.providerCode,
          nomA: account.providerDisplayName,
          cleApblic: '',
          cleApr: '',
          cleAtoken: '',
          nompays: '',
          nomOperateur: '',
          countryConfigs: [],
          environment: account.environment,
          enabled: account.enabled
        })));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading aggregators', err);
        this.isLoading.set(false);
      }
    });
  }

  loadPaymentRoutes() {
    this.agregateurService.getPaymentRoutes(this.isAdmin()).subscribe({
      next: (routes) => this.paymentRoutes.set(routes),
      error: (err) => console.error('Erreur lors du chargement des routes de paiement', err)
    });
  }

  togglePaymentRoute(route: PaymentRouteSetting) {
    const next = this.isAdmin() ? !route.platformEnabled : !(route.merchantEnabled ?? true);
    this.agregateurService.setPaymentRouteEnabled(route.routeId, next, this.isAdmin()).subscribe({
      next: (updated) => {
        this.paymentRoutes.update(list => list.map(r => r.routeId === updated.routeId ? updated : r));
      },
      error: (err) => {
        console.error('Erreur lors du changement de statut de la route', err);
        alert('Erreur lors du changement de statut de la route');
      }
    });
  }

  toggleAddForm() {
    if (this.showAddForm()) {
      this.showAddForm.set(false);
      this.resetForm();
    } else {
      this.newAggregator.set(this.emptyAggregator());
      this.showAddForm.set(true);
    }
  }

  addAggregator() {
    const aggregator = this.preparePayload(this.newAggregator());
    if (!this.canSaveAggregator(aggregator)) return;

    if (this.isAdmin()) {
      this.agregateurService.createPaymentProvider({
        code: aggregator.nomA,
        displayName: aggregator.nomA,
        status: 'ACTIVE',
        credentialSchema: this.defaultCredentialSchema(aggregator.nomA)
      }).subscribe({
        next: (provider) => {
          this.createRoutesForProvider(provider.id, aggregator);
          this.resetForm();
          this.showAddForm.set(false);
          this.loadSupportedProviders();
          this.loadAggregators();
          this.loadPaymentRoutes();
        },
        error: (err) => this.handleSaveError(err)
      });
      return;
    }

    const provider = this.supportedProviders().find(p => p.code === aggregator.nomA || p.displayName === aggregator.nomA);
    if (!provider) return;
    this.agregateurService.upsertProviderAccount({
      providerId: provider.id,
      environment: aggregator.environment || 'LIVE',
      enabled: aggregator.enabled !== false,
      credentials: this.credentialsFromAggregator(provider.code, aggregator)
    }).subscribe({
      next: () => {
        this.resetForm();
        this.showAddForm.set(false);
        this.loadAggregators();
      },
      error: (err) => this.handleSaveError(err)
    });
  }

  startEdit(agg: Agregateur, index: number) {
    this.editingAggregator.set(this.withNormalizedConfigs({
      ...agg,
      countryConfigs: this.countryConfigsFor(agg).map(config => ({ ...config }))
    }));
  }

  cancelEdit() {
    this.editingAggregator.set(null);
  }

  saveEdit() {
    const edited = this.editingAggregator();
    if (!edited || !edited.id) return;
    const payload = this.preparePayload(edited);
    if (!this.canSaveAggregator(payload)) return;

    if (this.isAdmin()) {
      this.agregateurService.updatePaymentProvider(edited.id, {
        code: payload.providerCode || payload.nomA,
        displayName: payload.nomA,
        status: payload.enabled === false ? 'INACTIVE' : 'ACTIVE',
        credentialSchema: payload.credentialSchema || this.defaultCredentialSchema(payload.nomA)
      }).subscribe({
        next: () => {
          this.cancelEdit();
          this.loadAggregators();
        },
        error: (err) => this.handleSaveError(err)
      });
      return;
    }

    this.agregateurService.upsertProviderAccount({
      providerId: payload.providerId!,
      environment: payload.environment || 'LIVE',
      enabled: payload.enabled !== false,
      credentials: this.credentialsFromAggregator(payload.providerCode || payload.nomA, payload)
    }).subscribe({
      next: () => {
        this.cancelEdit();
        this.loadAggregators();
      },
      error: (err) => this.handleSaveError(err)
    });
  }

  resetForm() {
    this.newAggregator.set(this.emptyAggregator());
  }

  deleteAggregator(index: number) {
    const agg = this.aggregators()[index];
    if (agg && agg.id && confirm('Voulez-vous vraiment supprimer cet agrégateur ?')) {
      const onDeleted = () => this.aggregators.update(list => list.filter(a => a.id !== agg.id));
      const onError = (err: unknown) => {
        console.error("Erreur lors de la suppression de l'agrégateur", err);
        alert('Erreur lors de la suppression');
      };
      if (this.isAdmin()) {
        this.agregateurService.deletePaymentProvider(agg.id).subscribe({ next: onDeleted, error: onError });
      } else {
        this.agregateurService.deleteProviderAccount(agg.id).subscribe({ next: onDeleted, error: onError });
      }
    }
  }

  toggleAggregatorEnabled(agg: Agregateur) {
    if (!agg.id) return;
    const next = !(agg.enabled ?? true);
    const onUpdated = () => this.loadAggregators();
    const onError = (err: unknown) => {
      console.error("Erreur lors du changement de statut de l'agrégateur", err);
      alert('Erreur lors du changement de statut');
    };
    if (this.isAdmin()) {
      this.agregateurService.setPaymentProviderStatus(agg.id, next ? 'ACTIVE' : 'INACTIVE')
        .subscribe({ next: onUpdated, error: onError });
    } else {
      this.agregateurService.setProviderAccountEnabled(agg.id, next)
        .subscribe({ next: onUpdated, error: onError });
    }
  }

  currentFormAggregator(): Agregateur {
    return this.editingAggregator() || this.newAggregator();
  }

  addCountryConfig() {
    const current = this.currentFormAggregator();
    current.countryConfigs = [...this.countryConfigsFor(current), { countryName: '', operators: '' }];
    this.refreshFormAggregator(current);
  }

  removeCountryConfig(index: number) {
    const current = this.currentFormAggregator();
    const configs = this.countryConfigsFor(current).filter((_, i) => i !== index);
    current.countryConfigs = configs.length ? configs : [{ countryName: '', operators: '' }];
    this.refreshFormAggregator(current);
  }

  operatorList(config: CountryConfig): string[] {
    return this.splitOperators(config.operators);
  }

  canSaveCurrent(): boolean {
    return this.canSaveAggregator(this.preparePayload(this.currentFormAggregator()));
  }

  supportedProviderNames(): string[] {
    const providers = Array.from(new Set(this.paymentRoutes()
      .map(route => route.providerCode?.trim().toUpperCase())
      .filter(Boolean)));
    const providerCodes = this.supportedProviders().map(provider => provider.code);
    return providerCodes.length ? providerCodes : providers.length ? providers : this.defaultSupportedProviders;
  }

  setMerchantProvider(provider: string) {
    const current = this.currentFormAggregator();
    current.nomA = provider;
    current.nompays = '';
    current.nomOperateur = '';
    current.countryConfigs = [];
    this.refreshFormAggregator(current);
  }

  handleOperatorKeydown(event: KeyboardEvent, config: CountryConfig) {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      this.commitOperator(config);
    }
  }

  handleOperatorInput(config: CountryConfig) {
    if (config.operatorDraft?.includes(',')) {
      this.commitOperator(config);
    }
  }

  commitOperator(config: CountryConfig) {
    const draft = (config.operatorDraft || '').replace(/,/g, '').trim();
    if (!draft) {
      config.operatorDraft = '';
      return;
    }
    const operators = this.operatorList(config);
    if (!operators.some(op => op.toUpperCase() === draft.toUpperCase())) {
      operators.push(draft);
      config.operators = operators.join(', ');
    }
    config.operatorDraft = '';
  }

  removeOperatorFromConfig(config: CountryConfig, operator: string) {
    config.operators = this.operatorList(config)
      .filter(op => op !== operator)
      .join(', ');
  }

  displayCountries(agg: Agregateur): string {
    return this.countryConfigsFor(agg)
      .map(config => config.countryName?.trim())
      .filter(Boolean)
      .join(', ') || agg.nompays || '-';
  }

  displayOperators(agg: Agregateur): string[] {
    const operators = this.countryConfigsFor(agg)
      .flatMap(config => this.splitOperators(config.operators));
    return Array.from(new Set(operators.length ? operators : this.splitOperators(agg.nomOperateur)));
  }

  countryConfigsFor(agg: Agregateur): CountryConfig[] {
    if (agg.countryConfigs?.length) {
      return agg.countryConfigs;
    }
    if (agg.nompays || agg.nomOperateur) {
      return [{ countryName: agg.nompays || '', operators: agg.nomOperateur || '' }];
    }
    return [{ countryName: '', operators: '' }];
  }

  getOperatorIcon(operator: string): string {
    const op = operator?.toUpperCase() || '';
    if (op.includes('ORANGE')) return 'phone_android';
    if (op.includes('MTN')) return 'cell_tower';
    if (op.includes('MOOV')) return 'tap_and_play';
    if (op.includes('WAVE')) return 'waves';
    return 'account_balance_wallet';
  }

  private createRoutesForProvider(providerId: number, aggregator: Agregateur) {
    this.countryConfigsFor(aggregator).forEach(config => {
      this.operatorList(config).forEach(operator => {
        this.agregateurService.createPaymentProviderRoute({
          providerId,
          direction: 'PAYIN',
          country: this.countryCode(config.countryName),
          operator,
          flowType: operator.toUpperCase() === 'WAVE' ? 'WAVE_REDIRECT' : 'MOBILE_MONEY_REQUEST',
          environment: 'LIVE',
          providerChannel: `${operator.toLowerCase()}-${this.countryCode(config.countryName).toLowerCase()}`,
          enabled: true,
          observedUp: true,
          priority: 100
        }).subscribe({ error: err => console.error('Erreur lors de la création de route', err) });
      });
    });
  }

  private credentialsFromAggregator(providerCode: string, aggregator: Agregateur): Record<string, string> {
    const credentials: Record<string, string> = {};
    if (providerCode.toUpperCase() === 'PAYDUNYA') {
      if (aggregator.cleApblic?.trim()) credentials['masterKey'] = aggregator.cleApblic.trim();
      if (aggregator.cleApr?.trim()) credentials['privateKey'] = aggregator.cleApr.trim();
      if (aggregator.cleAtoken?.trim()) credentials['token'] = aggregator.cleAtoken.trim();
      return credentials;
    }
    if (aggregator.cleApblic?.trim()) credentials['publicKey'] = aggregator.cleApblic.trim();
    if (aggregator.cleApr?.trim()) credentials['privateKey'] = aggregator.cleApr.trim();
    if (aggregator.cleAtoken?.trim()) credentials['token'] = aggregator.cleAtoken.trim();
    return credentials;
  }

  private defaultCredentialSchema(providerCode: string): string {
    return providerCode.toUpperCase() === 'PAYDUNYA'
      ? '{"fields":[{"key":"masterKey","label":"Master Key","required":true},{"key":"privateKey","label":"Private Key","required":true},{"key":"token","label":"Token","required":true}]}'
      : '{"fields":[{"key":"publicKey","label":"Public Key","required":true},{"key":"privateKey","label":"Private Key","required":true},{"key":"token","label":"Token","required":false}]}';
  }

  private countryCode(country: string): string {
    const map: Record<string, string> = { Benin: 'BJ', Senegal: 'SN', Togo: 'TG', Mali: 'ML', Niger: 'NE', Nigeria: 'NG', Ghana: 'GH', 'Cote d\'Ivoire': 'CI' };
    return map[country] || country.slice(0, 3).toUpperCase();
  }

  private handleSaveError(err: unknown) {
    console.error("Erreur lors de l'enregistrement de l'agrégateur", err);
    alert("Erreur lors de l'enregistrement");
  }

  private emptyAggregator(): Agregateur {
    return {
      nomA: '',
      cleApblic: '',
      cleApr: '',
      cleAtoken: '',
      nompays: '',
      nomOperateur: '',
      countryConfigs: this.isAdmin() ? [{ countryName: '', operators: '', operatorDraft: '' }] : [],
      enabled: true
    };
  }

  private withNormalizedConfigs(agg: Agregateur): Agregateur {
    const normalized = { ...agg };
    normalized.countryConfigs = this.countryConfigsFor(normalized).map(config => ({
      id: config.id,
      countryName: config.countryName || '',
      operators: config.operators || '',
      operatorDraft: ''
    }));
    return normalized;
  }

  private preparePayload(agg: Agregateur): Agregateur {
    const configs = this.countryConfigsFor(agg)
      .map(config => ({
        id: config.id,
        countryName: (config.countryName || '').trim(),
        operators: this.splitOperators(config.operators).join(', ')
      }))
      .filter(config => config.countryName && config.operators);

    const countries = configs.map(config => config.countryName).join(', ');
    const operators = Array.from(new Set(configs.flatMap(config => this.splitOperators(config.operators)))).join(', ');

    return {
      ...agg,
      nompays: countries,
      nomOperateur: operators,
      countryConfigs: configs
    };
  }

  private canSaveAggregator(agg: Agregateur): boolean {
    const hasProvider = !!agg.nomA?.trim();
    if (!hasProvider) return false;
    if (this.isAdmin()) return true;
    const providerCode = (agg.providerCode || agg.nomA || '').toUpperCase();
    const hasBaseKeys = !!agg.cleApblic?.trim() && !!agg.cleApr?.trim();
    return providerCode === 'PAYDUNYA' ? hasBaseKeys && !!agg.cleAtoken?.trim() : hasBaseKeys;
  }

  private hasValidCoverage(agg: Agregateur): boolean {
    return this.countryConfigsFor(agg).some(config =>
      !!config.countryName?.trim() && this.splitOperators(config.operators).length > 0);
  }

  private splitOperators(value?: string): string[] {
    return (value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private refreshFormAggregator(agg: Agregateur) {
    if (this.editingAggregator()) {
      this.editingAggregator.set({ ...agg });
    } else {
      this.newAggregator.set({ ...agg });
    }
  }
}
