## Objetivo
Eliminar divergências entre produtos reportados e itens da lista, ancorando os reportes no catálogo curado, tratando marca como atributo separado e dando ao admin a capacidade de mesclar entradas legadas.

## Parte A — Reporte ancorado no catálogo

**Tela `/report`**
- Substituir o input de texto livre de "Produto" por um seletor baseado no `CatalogPicker` (mesmo componente da lista).
- O usuário escolhe um item do catálogo → `product_key`, `product_name`, `category` e `unit` vêm do catálogo (consistência garantida).
- Manter um link discreto "Não encontrei meu produto → solicitar inclusão" (apenas registra um pedido simples para o admin avaliar; sem fluxo automático nessa fase).
- Campo `unit` deixa de ser editável no reporte (vem do catálogo). Quantidade/preço continuam livres.

**Campo "Marca" promovido a primeiro nível**
- A coluna `brand` em `price_reports` já existe; passar a exibi-la como input separado e opcional ("Ex.: Tio João, Camil — deixe em branco para qualquer marca").
- Marca **não** entra no `product_key`. Continua sendo só metadado do reporte.

## Parte B — Comparação consciente de marca

**`computeComparison` (`src/lib/comparison.ts`)**
- Continua agrupando por `product_key` (não muda a lógica de melhor preço por mercado).
- Passa a expor, junto do "melhor preço", a **marca vencedora** (ou "sem marca informada") para exibição.

**Tela da lista (`lists.$id.tsx`)**
- No card de cada item, mostrar as marcas disponíveis para aquele `product_key` no mercado escolhido, com o preço de cada uma (ex.: "Tio João R$ 28,90 · Camil R$ 26,50 · sem marca R$ 24,00").
- Padrão = melhor preço independente de marca; usuário pode visualizar a quebra.

**PDF (`export-pdf.ts`)**
- Incluir a marca vencedora ao lado do nome do produto na tabela comparativa quando houver.

## Parte D — Mesclagem retroativa no painel admin

**Nova aba "Produtos" em `/admin`**
- Lista os `product_key` distintos presentes em `price_reports` + `list_items`, marcando quais existem no `product_catalog` (✓) e quais são "órfãos" (texto livre legado).
- Ação **"Mesclar em…"**: seleciona um `product_key` órfão e escolhe um item do catálogo como destino. Resultado:
  - `UPDATE price_reports SET product_key, product_name, category, unit = (catálogo) WHERE product_key = origem`
  - `UPDATE list_items SET product_key, product_name, category, unit = (catálogo) WHERE product_key = origem`
- Ação **"Promover ao catálogo"**: cria entrada em `product_catalog` a partir de um `product_key` órfão (caso seja realmente um produto novo válido).
- Tudo via Server Function com `requireSupabaseAuth` + verificação `has_role(..., 'admin')`.

## Migração

```sql
-- Permitir admins editarem price_reports e list_items para mesclagem
CREATE POLICY "Admins manage all price_reports"
  ON public.price_reports FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all list_items"
  ON public.list_items FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
```

(Caso já existam políticas equivalentes, são pulados.)

## Detalhes técnicos

- **Sem mudança de schema** além das policies acima — `brand`, `product_catalog`, `user_roles` já existem.
- `CatalogPicker` precisa de uma variação "modo seleção única" (no `/report` o usuário escolhe 1 produto, não monta uma lista com quantidades). Pequena refatoração para aceitar `mode="single"`.
- Server Functions novas em `src/lib/admin.functions.ts`:
  - `listDistinctProductKeys()` — agrega de `price_reports` e `list_items`, anota se está no catálogo.
  - `mergeProductKey({ from, toCatalogId })` — executa os UPDATEs.
  - `promoteToCatalog({ productKey, name, category, unit })`.

## Fora de escopo (fica para depois)
- Fila de "solicitar inclusão" com workflow completo (apenas placeholder agora).
- Matching fuzzy automático com pg_trgm sugerindo produtos ao digitar.
- Mesclagem de marcas (normalizar "tio joao" vs "Tio João" como mesma marca).
