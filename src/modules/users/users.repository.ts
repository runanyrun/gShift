import { randomUUID } from "node:crypto";
import { CreateUserInput, UpdateUserInput, User, UserId } from "./users.types";

export interface UsersRepository {
  findAll(): Promise<User[]>;
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: UserId, input: UpdateUserInput): Promise<User | null>;
  delete(id: UserId): Promise<boolean>;
}

export class InMemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<UserId, User>();

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === normalizedEmail) {
        return user;
      }
    }
    return null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = new Date();
    const id = randomUUID();

    const user: User = {
      id,
      email: input.email.trim(),
      fullName: input.fullName.trim(),
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  async update(id: UserId, input: UpdateUserInput): Promise<User | null> {
    const existingUser = this.users.get(id);
    if (!existingUser) {
      return null;
    }

    const updatedUser: User = {
      ...existingUser,
      email: input.email?.trim() ?? existingUser.email,
      fullName: input.fullName?.trim() ?? existingUser.fullName,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id: UserId): Promise<boolean> {
    return this.users.delete(id);
  }
}
