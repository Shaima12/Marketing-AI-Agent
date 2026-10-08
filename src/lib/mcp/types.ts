export type DatabaseConnectionConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
};

export type DiscoveredTable = {
  schema: string;
  name: string;
  type: string;
  estimatedRowCount?: number | null;
};

export type DiscoveredColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string | null;
  isPrimaryKey?: boolean;
};

export type DiscoveredTableWithColumns = {
  table: DiscoveredTable;
  columns: DiscoveredColumn[];
};

export type DatabaseSchema = {
  tables: DiscoveredTableWithColumns[];
};