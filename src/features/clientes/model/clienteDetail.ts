import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/**
 * Domínio do detalhe do cliente — mesmo payload que `ClienteModel` / `listarConnections`
 * (`lib/models/cliente_model.dart`).
 */
export type ClienteDetail = SplitterCliente

/**
 * `:id` na rota `/clientes/:id` = `authenticationId` (campo `id` no JSON do BFF), não `client.id`.
 * Paridade com o cartão que abre `ClienteDetailPage` com o objeto já resolvido no Flutter.
 */
export type ClienteDetailRouteId = number
