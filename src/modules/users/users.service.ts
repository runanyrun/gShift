import {
  CreateUserInput,
  UpdateUserInput,
  User,
  UserId,
} from "./users.types";
import { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async listUsers(): Promise<User[]> {
    return this.repository.findAll();
  }

  async getUserById(id: UserId): Promise<User | null> {
    return this.repository.findById(id);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const existingUser = await this.repository.findByEmail(input.email);
    if (existingUser) {
      throw new Error("User email already exists.");
    }

    return this.repository.create(input);
  }

  async updateUser(id: UserId, input: UpdateUserInput): Promise<User | null> {
    if (input.email) {
      const userWithSameEmail = await this.repository.findByEmail(input.email);
      if (userWithSameEmail && userWithSameEmail.id !== id) {
        throw new Error("User email already exists.");
      }
    }

    return this.repository.update(id, input);
  }

  async deleteUser(id: UserId): Promise<boolean> {
    return this.repository.delete(id);
  }
}
