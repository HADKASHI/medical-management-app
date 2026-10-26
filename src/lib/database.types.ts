export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          authorization_id: string | null;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          cancelled_at: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          invite_sequence: number;
          invite_uid: string;
          location: string | null;
          notes: string | null;
          owner_id: string;
          provider: string | null;
          send_to_work_calendar: boolean;
          starts_at: string;
          title: string;
          visit_summary: string | null;
          status: Database['public']['Enums']['appointment_status'] | null;
        };
        ComputedFields: 'status';
        Insert: {
          authorization_id?: string | null;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          cancelled_at?: string | null;
          created_at?: string;
          ends_at: string;
          id?: string;
          invite_sequence?: number;
          invite_uid?: string;
          location?: string | null;
          notes?: string | null;
          owner_id?: string;
          provider?: string | null;
          send_to_work_calendar?: boolean;
          starts_at: string;
          title: string;
          visit_summary?: string | null;
        };
        Update: {
          authorization_id?: string | null;
          buffer_after_minutes?: number;
          buffer_before_minutes?: number;
          cancelled_at?: string | null;
          created_at?: string;
          ends_at?: string;
          id?: string;
          invite_sequence?: number;
          invite_uid?: string;
          location?: string | null;
          notes?: string | null;
          owner_id?: string;
          provider?: string | null;
          send_to_work_calendar?: boolean;
          starts_at?: string;
          title?: string;
          visit_summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_authorization_fkey';
            columns: ['owner_id', 'authorization_id'];
            isOneToOne: false;
            referencedRelation: 'authorizations';
            referencedColumns: ['owner_id', 'id'];
          },
        ];
      };
      authorizations: {
        Row: {
          archived_at: string | null;
          covers: string;
          created_at: string;
          expires_on: string;
          id: string;
          issued_on: string | null;
          owner_id: string;
          reference_number: string;
          renews_authorization_id: string | null;
          stock_item_id: string | null;
          type: Database['public']['Enums']['authorization_type'];
          renewed: boolean | null;
        };
        ComputedFields: 'renewed';
        Insert: {
          archived_at?: string | null;
          covers: string;
          created_at?: string;
          expires_on: string;
          id?: string;
          issued_on?: string | null;
          owner_id?: string;
          reference_number: string;
          renews_authorization_id?: string | null;
          stock_item_id?: string | null;
          type: Database['public']['Enums']['authorization_type'];
        };
        Update: {
          archived_at?: string | null;
          covers?: string;
          created_at?: string;
          expires_on?: string;
          id?: string;
          issued_on?: string | null;
          owner_id?: string;
          reference_number?: string;
          renews_authorization_id?: string | null;
          stock_item_id?: string | null;
          type?: Database['public']['Enums']['authorization_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'authorizations_renews_fkey';
            columns: ['owner_id', 'renews_authorization_id'];
            isOneToOne: false;
            referencedRelation: 'authorizations';
            referencedColumns: ['owner_id', 'id'];
          },
          {
            foreignKeyName: 'authorizations_stock_item_fkey';
            columns: ['owner_id', 'stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'stock_items';
            referencedColumns: ['owner_id', 'id'];
          },
        ];
      };
      dose_schedules: {
        Row: {
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          interval_days: number | null;
          owner_id: string;
          pattern: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id: string;
          weekdays: number[] | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          effective_from: string;
          effective_to?: string | null;
          id?: string;
          interval_days?: number | null;
          owner_id?: string;
          pattern: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id: string;
          weekdays?: number[] | null;
        };
        Update: {
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          interval_days?: number | null;
          owner_id?: string;
          pattern?: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id?: string;
          weekdays?: number[] | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dose_schedules_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['stock_item_id'];
          },
          {
            foreignKeyName: 'dose_schedules_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'stock_items';
            referencedColumns: ['id'];
          },
        ];
      };
      dose_times: {
        Row: {
          amount: number;
          dose_schedule_id: string;
          id: string;
          owner_id: string;
          time_of_day: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          dose_schedule_id: string;
          id?: string;
          owner_id?: string;
          time_of_day: string;
        };
        Update: {
          amount?: number;
          dose_schedule_id?: string;
          id?: string;
          owner_id?: string;
          time_of_day?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dose_times_dose_schedule_id_fkey';
            columns: ['dose_schedule_id'];
            isOneToOne: false;
            referencedRelation: 'dose_schedules';
            referencedColumns: ['id'];
          },
        ];
      };
      doses: {
        Row: {
          amount: number;
          dose_schedule_id: string | null;
          due_at: string | null;
          id: string;
          owner_id: string;
          status: Database['public']['Enums']['dose_status'];
          status_changed_at: string;
          stock_item_id: string;
          taken_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          dose_schedule_id?: string | null;
          due_at?: string | null;
          id?: string;
          owner_id?: string;
          status?: Database['public']['Enums']['dose_status'];
          status_changed_at?: string;
          stock_item_id: string;
          taken_at?: string | null;
        };
        Update: {
          amount?: number;
          dose_schedule_id?: string | null;
          due_at?: string | null;
          id?: string;
          owner_id?: string;
          status?: Database['public']['Enums']['dose_status'];
          status_changed_at?: string;
          stock_item_id?: string;
          taken_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'doses_dose_schedule_id_fkey';
            columns: ['dose_schedule_id'];
            isOneToOne: false;
            referencedRelation: 'dose_schedules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'doses_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['stock_item_id'];
          },
          {
            foreignKeyName: 'doses_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'stock_items';
            referencedColumns: ['id'];
          },
        ];
      };
      restocks: {
        Row: {
          authorization_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          owner_id: string;
          quantity: number;
          restocked_on: string;
          stock_item_id: string;
        };
        ComputedFields: never;
        Insert: {
          authorization_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          owner_id?: string;
          quantity: number;
          restocked_on: string;
          stock_item_id: string;
        };
        Update: {
          authorization_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string | null;
          owner_id?: string;
          quantity?: number;
          restocked_on?: string;
          stock_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restocks_authorization_fkey';
            columns: ['owner_id', 'authorization_id'];
            isOneToOne: false;
            referencedRelation: 'authorizations';
            referencedColumns: ['owner_id', 'id'];
          },
          {
            foreignKeyName: 'restocks_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['stock_item_id'];
          },
          {
            foreignKeyName: 'restocks_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'stock_items';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_counts: {
        Row: {
          counted_at: string;
          counted_quantity: number;
          id: string;
          owner_id: string;
          previous_quantity: number;
          stock_item_id: string;
        };
        ComputedFields: never;
        Insert: {
          counted_at?: string;
          counted_quantity: number;
          id?: string;
          owner_id?: string;
          previous_quantity: number;
          stock_item_id: string;
        };
        Update: {
          counted_at?: string;
          counted_quantity?: number;
          id?: string;
          owner_id?: string;
          previous_quantity?: number;
          stock_item_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_counts_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'alerts';
            referencedColumns: ['stock_item_id'];
          },
          {
            foreignKeyName: 'stock_counts_stock_item_id_fkey';
            columns: ['stock_item_id'];
            isOneToOne: false;
            referencedRelation: 'stock_items';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_items: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['stock_item_kind'];
          low_stock_threshold: number;
          name: string;
          owner_id: string;
          pack_size: number | null;
          quantity: number;
          strength: string | null;
          unit: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          kind: Database['public']['Enums']['stock_item_kind'];
          low_stock_threshold?: number;
          name: string;
          owner_id?: string;
          pack_size?: number | null;
          quantity?: number;
          strength?: string | null;
          unit: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database['public']['Enums']['stock_item_kind'];
          low_stock_threshold?: number;
          name?: string;
          owner_id?: string;
          pack_size?: number | null;
          quantity?: number;
          strength?: string | null;
          unit?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      alerts: {
        Row: {
          kind: string | null;
          message: string | null;
          needs_stock_count: boolean | null;
          stock_item_id: string;
        };
        ComputedFields: never;
        Insert: {
          kind?: never;
          message?: never;
          needs_stock_count?: never;
          stock_item_id?: string | null;
        };
        Update: {
          kind?: never;
          message?: never;
          needs_stock_count?: never;
          stock_item_id?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      archive_authorization: {
        Args: { authorization_id: string };
        Returns: {
          archived_at: string | null;
          covers: string;
          created_at: string;
          expires_on: string;
          id: string;
          issued_on: string | null;
          owner_id: string;
          reference_number: string;
          renews_authorization_id: string | null;
          stock_item_id: string | null;
          type: Database['public']['Enums']['authorization_type'];
        };
        SetofOptions: {
          from: '*';
          to: 'authorizations';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      archive_stock_item: {
        Args: { stock_item_id: string };
        Returns: {
          archived_at: string | null;
          created_at: string;
          id: string;
          kind: Database['public']['Enums']['stock_item_kind'];
          low_stock_threshold: number;
          name: string;
          owner_id: string;
          pack_size: number | null;
          quantity: number;
          strength: string | null;
          unit: string;
        };
        SetofOptions: {
          from: '*';
          to: 'stock_items';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_appointment: {
        Args: { appointment_id: string };
        Returns: {
          authorization_id: string | null;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          cancelled_at: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          invite_sequence: number;
          invite_uid: string;
          location: string | null;
          notes: string | null;
          owner_id: string;
          provider: string | null;
          send_to_work_calendar: boolean;
          starts_at: string;
          title: string;
          visit_summary: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      duplicate_appointment: {
        Args: { appointment_id: string; ends_at: string; starts_at: string };
        Returns: {
          authorization_id: string | null;
          buffer_after_minutes: number;
          buffer_before_minutes: number;
          cancelled_at: string | null;
          created_at: string;
          ends_at: string;
          id: string;
          invite_sequence: number;
          invite_uid: string;
          location: string | null;
          notes: string | null;
          owner_id: string;
          provider: string | null;
          send_to_work_calendar: boolean;
          starts_at: string;
          title: string;
          visit_summary: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'appointments';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      log_as_needed_dose: {
        Args: { amount: number; stock_item_id: string };
        Returns: {
          amount: number;
          dose_schedule_id: string | null;
          due_at: string | null;
          id: string;
          owner_id: string;
          status: Database['public']['Enums']['dose_status'];
          status_changed_at: string;
          stock_item_id: string;
          taken_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'doses';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      month_dose_schedules: {
        Args: { month: string };
        Returns: {
          effective_from: string;
          effective_to: string;
          id: string;
          pattern: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id: string;
          times: string[];
        }[];
      };
      month_doses: {
        Args: { month: string };
        Returns: {
          amount: number;
          dose_schedule_id: string;
          due_at: string;
          id: string;
          local_date: string;
          local_time: string;
          status: Database['public']['Enums']['dose_status'];
          stock_item_id: string;
          taken_at: string;
        }[];
      };
      record_restock: {
        Args: {
          authorization_id?: string;
          note?: string;
          packs?: number;
          quantity?: number;
          restocked_on?: string;
          stock_item_id: string;
        };
        Returns: {
          authorization_id: string | null;
          created_at: string;
          id: string;
          note: string | null;
          owner_id: string;
          quantity: number;
          restocked_on: string;
          stock_item_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'restocks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_stock_count: {
        Args: { counted_quantity: number; stock_item_id: string };
        Returns: {
          counted_at: string;
          counted_quantity: number;
          id: string;
          owner_id: string;
          previous_quantity: number;
          stock_item_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'stock_counts';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      renewal_chains: {
        Args: Record<PropertyKey, never>;
        Returns: {
          archived_at: string;
          covers: string;
          current_id: string;
          depth: number;
          expires_on: string;
          id: string;
          issued_on: string;
          reference_number: string;
          renewed: boolean;
          restocks: Json;
          stock_item_id: string;
          type: Database['public']['Enums']['authorization_type'];
        }[];
      };
      renewed: {
        Args: { '': Database['public']['Tables']['authorizations']['Row'] };
        Returns: {
          error: true;
        } & 'the function public.renewed with parameter or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache';
      };
      save_dose_schedule: {
        Args: {
          effective_from?: string;
          interval_days?: number;
          pattern: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id: string;
          times?: Json;
          weekdays?: number[];
        };
        Returns: {
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          interval_days: number | null;
          owner_id: string;
          pattern: Database['public']['Enums']['dose_schedule_pattern'];
          stock_item_id: string;
          weekdays: number[] | null;
        };
        SetofOptions: {
          from: '*';
          to: 'dose_schedules';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_dose_status: {
        Args: { dose_id: string; status: Database['public']['Enums']['dose_status'] };
        Returns: {
          amount: number;
          dose_schedule_id: string | null;
          due_at: string | null;
          id: string;
          owner_id: string;
          status: Database['public']['Enums']['dose_status'];
          status_changed_at: string;
          stock_item_id: string;
          taken_at: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'doses';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      status: {
        Args: {
          appointment: Omit<
            Database['public']['Tables']['appointments']['Row'],
            Database['public']['Tables']['appointments']['ComputedFields']
          >;
        };
        Returns: Database['public']['Enums']['appointment_status'];
      };
      take_doses: {
        Args: { dose_ids: string[] };
        Returns: {
          amount: number;
          dose_schedule_id: string | null;
          due_at: string | null;
          id: string;
          owner_id: string;
          status: Database['public']['Enums']['dose_status'];
          status_changed_at: string;
          stock_item_id: string;
          taken_at: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'doses';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
    };
    Enums: {
      appointment_status: 'scheduled' | 'done' | 'cancelled';
      authorization_type: 'prescription' | 'form_17' | 'commitment';
      dose_schedule_pattern: 'daily' | 'weekdays' | 'every_n_days' | 'as_needed';
      dose_status: 'pending' | 'taken' | 'skipped' | 'missed';
      stock_item_kind: 'medication' | 'supply';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: ['scheduled', 'done', 'cancelled'],
      authorization_type: ['prescription', 'form_17', 'commitment'],
      dose_schedule_pattern: ['daily', 'weekdays', 'every_n_days', 'as_needed'],
      dose_status: ['pending', 'taken', 'skipped', 'missed'],
      stock_item_kind: ['medication', 'supply'],
    },
  },
} as const;
