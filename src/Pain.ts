import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { DependencyContainer } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

class Pain implements IPostDBLoadMod {
    public logger: ILogger;

    /**
     * Cycles through all items and sets the ExaminedByDefault property to false.
     */
    public postDBLoad(container: DependencyContainer): void {
        const logger = container.resolve<ILogger>("WinstonLogger");
        
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const tables: IDatabaseTables = databaseServer.getTables();
        const items = tables.templates.items;

        let itemCount = 0;

        for (const item of Object.values(items)) {
            if (item._props && typeof item._props.ExaminedByDefault === "boolean") {
                item._props.ExaminedByDefault = false;
                itemCount++;
            }
        }

        logger.logWithColor(`PAIN: Updated ${itemCount} items to be unexamined by default.`, LogTextColor.CYAN);
    }
}

module.exports = { mod: new Pain() };
