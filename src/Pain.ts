import { DependencyContainer, Lifecycle } from "tsyringe";
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { IPmcData } from "@spt/models/eft/common/IPmcData";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { SaveServer } from "@spt/servers/SaveServer";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";
import { FileSystemSync } from "@spt/utils/FileSystemSync";
import { ISptProfile } from "@spt/models/eft/profile/ISptProfile";
import { IRegisterData } from "@spt/models/eft/launcher/IRegisterData";
import { LauncherController } from "@spt/controllers/LauncherController";
import { HashUtil } from "@spt/utils/HashUtil";
import { Info } from "@spt/models/eft/profile/ISptProfile";

/**
 * P A I N
 */
class Pain implements IPostDBLoadMod {
    private static logger: ILogger;
    private static profileHelper: ProfileHelper;
    private static saveServer: SaveServer;
    private static fileSystemSync: FileSystemSync;
    private static itemHelper: ItemHelper;
    private static launcherController: any; // Using `any` to access protected methods.
    private static hashUtil: HashUtil;

    private static readonly PAINED_PROFILES = "./user/mods/refringe-pain/painedProfiles.json";

    /**
     * Register a static router for the PAIN client game mode route.
     *
     * @param container - The dependency injection container.
     */
    public preSptLoad(container: DependencyContainer): void {
        Pain.logger = container.resolve<ILogger>("WinstonLogger");
        Pain.fileSystemSync = container.resolve<FileSystemSync>("FileSystemSync");
        Pain.saveServer = container.resolve<SaveServer>("SaveServer");
        Pain.profileHelper = container.resolve<ProfileHelper>("ProfileHelper");
        Pain.itemHelper = container.resolve<ItemHelper>("ItemHelper");
        Pain.launcherController = container.resolve<LauncherController>("LauncherController");
        Pain.hashUtil = container.resolve<HashUtil>("HashUtil");

        const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");
        staticRouterModService.registerStaticRouter(
            "PainClientGameMode",
            [
                {
                    url: "/client/game/mode",
                    action: async (url, info, sessionId, output) => {
                        this.adjustReadyProfile(sessionId);
                        return output;
                    },
                },
            ],
            "PainClientGameMode",
        );

        // Replace the createAccount method in LauncherController to capture the profile IDs of new accounts.
        container.afterResolution("LauncherController", (_t, result: any) =>
        {
            result.createAccount = (info: IRegisterData) =>
            {
                return this.painCreateAccount(info);
            }
        }, {frequency: "Always"});
    }

    /**
     * Initializes the PAIN mod by updating database items and profile templates.
     *
     * @param container - The dependency injection container.
     */
    public postDBLoad(container: DependencyContainer): void {
        const tables: IDatabaseTables = container.resolve<DatabaseServer>("DatabaseServer").getTables();
        this.initializePainedProfilesFile();
        this.updateItemsToUnexaminedByDefault(tables);
        this.updateProfileTemplateEncyclopedias(tables);
    }

    /**
     * Adjusts a profile that has already been created, but has not been adjusted yet. By default, all items that are on
     * the PMC or in the stash are examined.
     *
     * @param sessionId - The session ID of the profile to adjust.
     */
    private adjustReadyProfile(sessionId: string): void {
        // Check to see if this profile has already been pained.
        const painedProfiles: string[] = JSON.parse(Pain.fileSystemSync.read(Pain.PAINED_PROFILES));
        if (painedProfiles.includes(sessionId)) {
            Pain.logger.logWithColor(`PAIN: Account "${this.fetchProfileUsername(sessionId)}" has already been pained. You a real one.`, LogTextColor.CYAN);
            return;
        }

        const profile: IPmcData = Pain.profileHelper.getPmcProfile(sessionId);
        if (!profile?.Inventory?.items) {
            Pain.logger.logWithColor(
                `PAIN: Could not find items in account "${this.fetchProfileUsername(sessionId)}".`,
                LogTextColor.GRAY,
            );
            return;
        }

        // Set all items in the profile to examined.
        const encyclopediaMap = new Map<string, boolean>();
        for (const item of profile.Inventory.items) {
            encyclopediaMap.set(item._tpl, true);
        }
        profile.Encyclopedia = Object.fromEntries(encyclopediaMap);

        Pain.saveServer.saveProfile(sessionId);

        // Mark this profile as pained.
        this.addProfileToPainedList(sessionId);
    }

    /**
     * Adds a profile to the pained profiles list and persists it to disk.
     *
     * @param sessionId - The session ID of the profile to add to the pained list.
     */
    private addProfileToPainedList(sessionId: string): void {
        const painedProfiles: string[] = JSON.parse(Pain.fileSystemSync.read(Pain.PAINED_PROFILES));
        painedProfiles.push(sessionId);
        Pain.fileSystemSync.writeJson(Pain.PAINED_PROFILES, painedProfiles);
        Pain.logger.logWithColor(`PAIN: Account "${this.fetchProfileUsername(sessionId)}" has been pained.`, LogTextColor.CYAN);
    }

    /**
     * Updates the ExaminedByDefault property for most items in the database to false.
     *
     * @param tables - The database tables containing item templates.
     */
    private updateItemsToUnexaminedByDefault(tables: IDatabaseTables): void {
        let itemCount = 0;
        for (const item of Object.values(tables.templates.items)) {
            if (
                item._props &&
                typeof item._props.ExaminedByDefault === "boolean" &&
                Pain.itemHelper.isDogtag(item._id) === false &&
                Pain.itemHelper.isOfBaseclass(item._id, "65649eb40bf0ed77b8044453") === false // BuiltInInserts
            ) {
                item._props.ExaminedByDefault = false;
                itemCount++;
            }
        }

        Pain.logger.logWithColor(`PAIN: Updated ${itemCount} items to be unexamined by default.`, LogTextColor.CYAN);
    }

    /**
     * Sets the Encyclopedia property for all future profiles based on their starting inventory.
     *
     * @param tables - The database tables containing profile templates.
     */
    private updateProfileTemplateEncyclopedias(tables: IDatabaseTables): void {
        for (const profileType of Object.values(tables.templates.profiles)) {
            for (const faction of ["bear", "usec"]) {
                const encyclopediaMap = new Map<string, boolean>();
                for (const item of profileType[faction].character.Inventory.items) {
                    encyclopediaMap.set(item._tpl, true);
                }
                profileType[faction].character.Encyclopedia = Object.fromEntries(encyclopediaMap);
            }
        }
    }

    /**
     * Initializes the pained profiles file if it doesn't exist.
     */
    private initializePainedProfilesFile(): void {
        if (!Pain.fileSystemSync.exists(Pain.PAINED_PROFILES)) {
            Pain.fileSystemSync.write(Pain.PAINED_PROFILES, "[]");
            Pain.logger.logWithColor(
                `PAIN: Created pained profiles file at ${Pain.PAINED_PROFILES}.`,
                LogTextColor.CYAN,
            );
        } else {
            Pain.logger.logWithColor(
                `PAIN: Pained profiles file already exists at ${Pain.PAINED_PROFILES}.`,
                LogTextColor.GRAY,
            );
        }
    }

    /**
     * Fetches the username of a profile based on its session ID.
     *
     * @param sessionId - The session ID of the profile.
     * @returns The username of the profile, or "name_not_found" if it cannot be retrieved.
     */
    private fetchProfileUsername(sessionId: string): string {
        try {
            const profile: ISptProfile = Pain.profileHelper.getFullProfile(sessionId);
            return profile.info.username;
        } catch (error) {
            return "name_not_found";
        }
    }

    /**
     * Replacement method for the original createAccount method in LauncherController. Simply used to capture profile IDs
     * of new accounts so they can be added to the pained list.
     */
    protected async painCreateAccount(info: IRegisterData): Promise<string> {
        const profileId = Pain.launcherController.generateProfileId();
        const scavId = Pain.launcherController.generateProfileId();
        const newProfileDetails: Info = {
            id: profileId,
            scavId: scavId,
            aid: Pain.hashUtil.generateAccountId(),
            username: info.username,
            password: info.password,
            wipe: true,
            edition: info.edition,
        };
        Pain.saveServer.createProfile(newProfileDetails);

        await Pain.saveServer.loadProfile(profileId);
        await Pain.saveServer.saveProfile(profileId);

        this.addProfileToPainedList(profileId); // This is the only change to the original method.

        return profileId;
    }
}

module.exports = { mod: new Pain() };
