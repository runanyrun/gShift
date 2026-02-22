import { CreateUserInput, UpdateUserInput, UserId } from "./users.types";
import { UsersService } from "./users.service";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  list() {
    return this.usersService.listUsers();
  }

  getById(id: UserId) {
    return this.usersService.getUserById(id);
  }

  create(payload: CreateUserInput) {
    return this.usersService.createUser(payload);
  }

  update(id: UserId, payload: UpdateUserInput) {
    return this.usersService.updateUser(id, payload);
  }

  remove(id: UserId) {
    return this.usersService.deleteUser(id);
  }
}
