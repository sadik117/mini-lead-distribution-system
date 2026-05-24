export interface Service {
  id: number;
  name: string;
}

export interface Lead {
  id: string;
  customerName: string;
  phone: string;
  city: string;
  serviceId: number;
  description: string;
  createdAt: string;
  service?: Service;
}

export interface LeadAssignment {
  id: string;
  leadId: string;
  providerId: number;
  assignedAt: string;
  lead: Lead;
}

export interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceivedThisMonth: number;
  remainingQuota: number;
  assignments: LeadAssignment[];
}
