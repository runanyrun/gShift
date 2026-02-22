export type UserId = string;

export interface User {
  id: UserId;
  email: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
}
