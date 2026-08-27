import { createClient, SupabaseClient } from "@supabase/supabase-js";
import config from "@/config";
import { ISupabaseService, DatabaseError } from "@/types";
import logger from "@/utils/logger";

class SupabaseService implements ISupabaseService {
  private client: SupabaseClient;
  private storageClient: SupabaseClient;

  constructor() {
    // Both clients use the secret key.
    //
    // This used to build `client` from the *anon* key. Every table this server
    // writes - devices, device_channels, update_logs, native_update_logs - has
    // row level security enabled, and every policy on them is keyed on an
    // authenticated dashboard user via can_access_app(). This process never
    // forwards a user's JWT to Supabase; it builds one client at boot. So an
    // anon (or publishable) client can satisfy no policy here, and its writes
    // are rejected rather than failing loudly.
    //
    // Authorisation for these routes is enforced in middleware/auth.ts,
    // checkAppAccess and checkOrgAccess - before any query is built. A trusted
    // server holding the secret key is the model this design already assumed.
    this.client = createClient(config.supabase.url, config.supabase.secretKey);
    this.storageClient = createClient(config.supabase.url, config.supabase.secretKey);

    logger.info("Supabase service initialized", {
      url: config.supabase.url,
      bucket: config.supabase.bucketName,
    });
  }

  async query(table: string, options: any = {}): Promise<any> {
    console.log("====== QUERY START ======");
    console.log("Table:", table);
    console.log("Options:", JSON.stringify(options, null, 2));

    try {
      if (options.count) {
        console.log("Executing COUNT query");
        let countQuery = this.client
          .from(table)
          .select(options.select || "*", { count: options.count, head: true });

        if (options.match && Object.keys(options.match).length > 0) {
          console.log("Applying match filter:", options.match);
          countQuery = countQuery.match(options.match);
        }

        if (options.eq) {
          console.log("Applying eq filter:", options.eq);
          Object.entries(options.eq).forEach(([key, value]) => {
            countQuery = countQuery.eq(key, value as any);
          });
        }

        const { count, error } = await countQuery;

        if (error) {
          console.error("====== COUNT QUERY ERROR ======");
          console.error("Table:", table);
          console.error("Error object:", error);
          console.error("Error message:", error.message);
          console.error("Error code:", error.code);
          console.error("Error details:", error.details);
          console.error("Error hint:", error.hint);
          console.error("==============================");

          logger.error(
            `Supabase count query error [table: ${table}] - ${
              error.message
            } (code: ${error.code}, details: ${JSON.stringify(
              error.details,
            )}, hint: ${error.hint})`,
            {
              options,
            },
          );
          throw new DatabaseError(`Count query failed: ${error.message}`);
        }

        console.log("Count query successful. Count:", count);
        return { data: null, count };
      }

      console.log("Executing REGULAR query");
      let queryBuilder = this.client.from(table).select(options.select || "*");

      if (options.match && Object.keys(options.match).length > 0) {
        console.log("Applying match filter:", options.match);
        queryBuilder = queryBuilder.match(options.match);
      }

      if (options.eq) {
        console.log("Applying eq filter:", options.eq);
        Object.entries(options.eq).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value as any);
        });
      }

      if (options.gt) {
        console.log("Applying gt filter:", options.gt);
        Object.entries(options.gt).forEach(([key, value]) => {
          queryBuilder = queryBuilder.gt(key, value as any);
        });
      }

      if (!options.count && options.order?.column) {
        queryBuilder = queryBuilder.order(options.order.column, {
          ascending: options.order.ascending !== false,
        });
      }

      if (!options.count) {
        queryBuilder = queryBuilder.limit(options.limit || 100);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error("====== REGULAR QUERY ERROR ======");
        console.error("Table:", table);
        console.error("Error object:", error);
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        console.error("=================================");

        logger.error(`TEST ERROR MESSAGE: ${error.message}`, {});
        throw new DatabaseError(`Query failed: ${error.message}`);
      }

      console.log("Query successful. Rows:", data?.length);
      return { data, count: null };
    } catch (error) {
      console.error("====== CATCH BLOCK ERROR ======");
      console.error("Error:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
      console.error("===============================");

      logger.error(
        `Supabase service query error [table: ${table}] - ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          options,
        },
      );
      throw error;
    }
  }

  async insert(table: string, data: any): Promise<any> {
    try {
      const { data: result, error } = await this.client.from(table).insert(data).select();

      if (error) {
        logger.error("Supabase insert error", { table, data, error });
        throw new DatabaseError(`Insert failed: ${error.message}`, error.code);
      }

      return result;
    } catch (error) {
      logger.error("Supabase service insert error", { table, data, error });
      throw error;
    }
  }

  /**
   * Insert or update in one round trip, keyed on `onConflict`.
   *
   * Only the keys present in `data` are written, so an upsert of a subset of
   * columns leaves the rest of an existing row untouched - which is what the
   * device telemetry path needs: a stats call knows the platform and version,
   * a channel assignment knows the channel, and neither should blank the
   * other's columns.
   */
  async upsert(
    table: string,
    data: any,
    options: { onConflict: string; select?: string },
  ): Promise<any> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .upsert(data, { onConflict: options.onConflict })
        .select(options.select || "*");

      if (error) {
        logger.error("Supabase upsert error", { table, data, error });
        throw new DatabaseError(`Upsert failed: ${error.message}`, error.code);
      }

      return result;
    } catch (error) {
      logger.error("Supabase service upsert error", { table, data, error });
      throw error;
    }
  }

  async update(table: string, data: any, filter: any): Promise<any> {
    try {
      let query = this.client.from(table).update(data);

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();

      if (error) {
        logger.error("Supabase update error", { table, data, filter, error });
        throw new DatabaseError(`Update failed: ${error.message}`, error.code);
      }

      return result;
    } catch (error) {
      logger.error("Supabase service update error", {
        table,
        data,
        filter,
        error,
      });
      throw error;
    }
  }

  async delete(table: string, filter: any): Promise<any> {
    try {
      let query = this.client.from(table).delete();

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error } = await query;

      if (error) {
        logger.error("Supabase delete error", { table, filter, error });
        throw new DatabaseError(`Delete failed: ${error.message}`, error.code);
      }

      return { success: true };
    } catch (error) {
      logger.error("Supabase service delete error", { table, filter, error });
      throw error;
    }
  }

  async uploadFile(
    fileName: string,
    buffer: Buffer,
    contentType: string = "application/zip",
  ): Promise<string> {
    try {
      const { error } = await this.storageClient.storage
        .from(config.supabase.bucketName)
        .upload(fileName, buffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        logger.error("Supabase storage upload error", { fileName, error });
        throw new DatabaseError(`File upload failed: ${error.message}`);
      }

      const { data: urlData } = this.storageClient.storage
        .from(config.supabase.bucketName)
        .getPublicUrl(fileName);

      logger.info("File uploaded to Supabase storage", {
        fileName,
        url: urlData.publicUrl,
      });
      return urlData.publicUrl;
    } catch (error) {
      logger.error("Supabase service file upload error", { fileName, error });
      throw error;
    }
  }

  async createSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.storageClient.storage
        .from(config.supabase.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        logger.error("Supabase create signed URL error", { filePath, error });
        throw new DatabaseError(`Create signed URL failed: ${error.message}`);
      }

      logger.info("Signed URL created", {
        filePath,
        url: data.signedUrl,
      });
      return data.signedUrl;
    } catch (error) {
      logger.error("Supabase service create signed URL error", {
        filePath,
        error,
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client.from("apps").select("id").limit(1);

      return !error;
    } catch (error) {
      logger.error("Supabase health check failed", { error });
      return false;
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getAdminClient(): SupabaseClient {
    return this.storageClient;
  }

  getStorageClient(): SupabaseClient {
    return this.storageClient;
  }
}

export default new SupabaseService();
