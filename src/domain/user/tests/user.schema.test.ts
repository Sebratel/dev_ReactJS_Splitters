import { describe, it, expect } from 'vitest';
import { userSchema } from '@domain/user/schemas/user.schema';

describe('userSchema', () => {
  // Caso de sucesso
  it('deve validar um usuário com dados válidos', () => {
    const validUser = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      age: 30,
    };
    const result = userSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('John Doe');
      expect(result.data.email).toBe('john.doe@example.com');
      expect(result.data.age).toBe(30);
      expect(result.data.isActive).toBe(true); // default value
      expect(result.data.roles).toEqual(['user']); // default value
    }
  });

  // Caso de sucesso com valores mínimos
  it('deve validar um usuário com nome e email mínimos', () => {
    const validUserMinimal = {
      name: 'Jon',
      email: 'j@a.com',
    };
    const result = userSchema.safeParse(validUserMinimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Jon');
      expect(result.data.email).toBe('j@a.com');
    }
  });

  // Caso de erro: nome muito curto
  it('deve falhar se o nome for muito curto', () => {
    const invalidUser = {
      name: 'Jo',
      email: 'john.doe@example.com',
    };
    const result = userSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Nome deve ter no mínimo 3 caracteres');
    }
  });

  // Caso de erro: email inválido
  it('deve falhar se o email for inválido', () => {
    const invalidUser = {
      name: 'John Doe',
      email: 'invalid-email',
    };
    const result = userSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email inválido');
    }
  });

  // Caso de erro: age não é um número positivo
  it('deve falhar se a idade não for um número inteiro positivo', () => {
    const invalidUser = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      age: -5,
    };
    const result = userSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Idade deve ser um número inteiro positivo');
    }
  });

  // Caso de erro: roles vazio
  it('deve falhar se roles for um array vazio', () => {
    const invalidUser = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      roles: [],
    };
    const result = userSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Deve ter pelo menos uma função');
    }
  });

  // Edge case: valores undefined para campos opcionais
  it('deve validar um usuário com campos opcionais undefined', () => {
    const userWithUndefinedOptionals = {
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      age: undefined,
      id: undefined,
    };
    const result = userSchema.safeParse(userWithUndefinedOptionals);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Jane Doe');
      expect(result.data.email).toBe('jane.doe@example.com');
      expect(result.data.age).toBeUndefined();
      expect(result.data.id).toBeUndefined();
    }
  });

  // Edge case: ID inválido
  it('deve falhar se o ID for inválido', () => {
    const invalidIdUser = {
      id: 'invalid-uuid',
      name: 'John Doe',
      email: 'john.doe@example.com',
    };
    const result = userSchema.safeParse(invalidIdUser);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('ID inválido');
    }
  });
});
