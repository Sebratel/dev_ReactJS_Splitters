import { z } from 'zod';

export const splitterMapFormSchema = z.object({
  mapName: z.string().min(3, "O nome do mapa deve ter no mínimo 3 caracteres."),
  // Outros campos do formulário, se houver, seriam adicionados aqui
});

export type SplitterMapFormInputs = z.infer<typeof splitterMapFormSchema>;
