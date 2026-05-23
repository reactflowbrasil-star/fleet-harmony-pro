# Setup: confirmação de entrega (foto + assinatura)

A confirmação de entrega persiste:

- **Foto(s)** da mercadoria/destinatário (até 4 por entrega)
- **Assinatura à mão** do destinatário (canvas → PNG)
- **Nome + documento** do recebedor
- **Coordenadas GPS** no momento da entrega
- **Observações** opcionais

## Passos de configuração

### 1. Aplicar a migration

```bash
supabase db push
```

Isso cria:
- `public.trip_deliveries` (tabela)
- RLS por `company_id` (motorista insere apenas as suas; managers/admins leem da empresa)
- Realtime ligado
- Policies no `storage.objects` para o bucket `delivery-proofs`

### 2. Criar o bucket no Storage

No painel Supabase → **Storage** → **New bucket**:

- **Name**: `delivery-proofs`
- **Public bucket**: **OFF** (privado — leitura via URL assinada)
- **File size limit**: 10 MB (recomendado)
- **Allowed MIME types**: `image/*` (recomendado)

> A migration já criou as policies que escopam acesso por `company_id`
> (encoded como primeiro segmento do path: `{company_id}/{trip_id}/...`).

### 3. Pronto

No portal do motorista, durante uma viagem ativa, aparece o botão verde
**"Confirmar entrega"**. O motorista preenche, tira fotos, pega a assinatura
no celular e envia.

No painel admin (em breve, na página de detalhes da viagem) os comprovantes
ficam acessíveis com URL assinada (1h de validade por padrão).

## Estrutura do path no bucket

```
delivery-proofs/
└── {company_id}/
    └── {trip_id}/
        ├── photo_{timestamp}_{uid}.jpg
        ├── photo_{timestamp}_{uid}.jpg
        └── signature_{timestamp}_{uid}.png
```

## Troubleshooting

**"Bucket 'delivery-proofs' não existe"** — passo 2 acima.

**"new row violates row-level security policy"** — a migration não rodou,
ou o caller não é membro da company_id passada. Verifique `user_roles`.

**Foto não abre na câmera** — alguns navegadores (Safari iOS) só
abrem câmera direto se o site for HTTPS. Em dev, use `npm run dev -- --host`
+ ngrok ou similar.
