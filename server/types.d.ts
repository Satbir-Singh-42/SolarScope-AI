declare module "connect-pg-simple" {
  import session from "express-session";
  import { Pool } from "@neondatabase/serverless";
  function connectPg(
    session: typeof import("express-session"),
  ): new (options: {
    pool?: Pool;
    conString?: string;
    tableName?: string;
    createTableIfMissing?: boolean;
  }) => session.Store;
  export default connectPg;
}
