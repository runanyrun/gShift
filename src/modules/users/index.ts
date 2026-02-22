import { UsersController } from "./users.controller";
import { InMemoryUsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

export * from "./users.types";
export * from "./users.repository";
export * from "./users.service";
export * from "./users.controller";

export function createUsersModule() {
  const repository = new InMemoryUsersRepository();
  const service = new UsersService(repository);
  const controller = new UsersController(service);

  return {
    repository,
    service,
    controller,
  };
}
