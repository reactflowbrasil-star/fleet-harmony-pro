# Setup: criação de acesso de login para motoristas

O cadastro de motorista (`/drivers`) tem um campo **Senha de acesso** que cria
ou redefine a conta de login do motorista no Supabase Auth. Isso só funciona
se a Edge Function `create-driver-user` estiver deployada no seu projeto Supabase.

## Por que uma Edge Function?

Criar um usuário em `auth.users` exige a `service_role key`. Essa chave **não pode**
ficar no client (vaza acesso total ao banco). A Edge Function roda no Supabase com
a service_role e expõe apenas a operação específica de criar/atualizar conta de
motorista, validando antes que o caller é admin/manager da mesma empresa.

## Pré-requisitos

- Supabase CLI instalado: <https://supabase.com/docs/guides/cli>
- Já estar logado: `supabase login`
- Link com o projeto: `supabase link --project-ref pukbvrvkuhsorfwgvelj`

## Deploy

A partir da raiz do repositório:

```bash
supabase functions deploy create-driver-user
```

Pronto. Não precisa configurar variáveis — `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pelo runtime.

## Verificar deploy

```bash
supabase functions list
```

Você deve ver `create-driver-user` na lista. Ou veja no painel:
`https://supabase.com/dashboard/project/<seu-ref>/functions`

## Como o admin usa

1. Vai em `/drivers` → "Novo motorista".
2. Preenche **E-mail (login)** e **Senha de acesso**.
3. Clica "Cadastrar".
4. O sistema:
   - cria/atualiza a linha em `drivers`
   - chama a Edge Function que cria o auth user
   - vincula `drivers.user_id` ao novo auth user
   - garante role `driver` em `user_roles`

Se você esqueceu a senha de um motorista existente, edite-o, preencha o campo
"Nova senha (opcional)" e salve.

## Troubleshooting

**"Edge Function 'create-driver-user' ainda não foi deployada"** — rode `supabase functions deploy create-driver-user`.

**"Sem permissão para criar acesso de motorista"** — o usuário logado precisa ter role
`admin` ou `fleet_manager` na empresa do motorista. Verifique em `user_roles`.

**"Motorista não encontrado"** — o `driver_id` enviado não existe. Pode acontecer
se o insert do drivers falhar silenciosamente; recarregue a página e tente de novo.

**Email já existe** — a function detecta o caso, mantém o auth user existente e
apenas atualiza a senha + vincula ao driver_id atual.
