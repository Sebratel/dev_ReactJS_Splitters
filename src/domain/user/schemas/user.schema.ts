import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid("ID inválido").optional(),
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(255, "Nome deve ter no máximo 255 caracteres"),
  email: z.string().email("Email inválido"),
  age: z.number().int().positive("Idade deve ser um número inteiro positivo").optional(),
  isActive: z.boolean().default(true),
  roles: z.array(z.string()).min(1, "Deve ter pelo menos uma função").default(['user']),
});

export type User = z.infer<typeof userSchema>;
