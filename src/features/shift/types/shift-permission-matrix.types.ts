export type ShiftRole = "owner" | "admin" | "user";

export type ShiftAction = "createShift" | "listShifts" | "updateShift" | "deleteShift";

export interface ShiftPermissionRule {
  action: ShiftAction;
  allowed: boolean;
  tenantScoped: true;
}

export type ShiftPermissionMatrix = Record<ShiftRole, ShiftPermissionRule[]>;

export const SHIFT_PERMISSION_MATRIX: ShiftPermissionMatrix = {
  owner: [
    { action: "createShift", allowed: true, tenantScoped: true },
    { action: "listShifts", allowed: true, tenantScoped: true },
    { action: "updateShift", allowed: false, tenantScoped: true },
    { action: "deleteShift", allowed: false, tenantScoped: true },
  ],
  admin: [
    { action: "createShift", allowed: true, tenantScoped: true },
    { action: "listShifts", allowed: true, tenantScoped: true },
    { action: "updateShift", allowed: false, tenantScoped: true },
    { action: "deleteShift", allowed: false, tenantScoped: true },
  ],
  user: [
    { action: "createShift", allowed: false, tenantScoped: true },
    { action: "listShifts", allowed: true, tenantScoped: true },
    { action: "updateShift", allowed: false, tenantScoped: true },
    { action: "deleteShift", allowed: false, tenantScoped: true },
  ],
};
