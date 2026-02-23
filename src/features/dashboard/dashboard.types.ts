export interface DashboardOverview {
  userId: string;
  companyId: string;
  usersCount: number;
  shiftsCount: number;
}

export interface DashboardShiftItem {
  id: string;
  companyId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
}
