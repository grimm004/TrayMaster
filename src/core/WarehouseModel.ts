import {Warehouse} from "./WarehouseModel/Layers/Warehouse";
import {Zone} from "./WarehouseModel/Layers/Zone";
import {Bay} from "./WarehouseModel/Layers/Bay";
import {Shelf} from "./WarehouseModel/Layers/Shelf";
import {Column} from "./WarehouseModel/Layers/Column";
import {Tray} from "./WarehouseModel/Layers/Tray";
import Utils from "./WarehouseModel/Utils";
import {DatabaseDocument} from "./Firebase/Database";
import firebase, {ONLINE} from "./Firebase";

/**
 * Represents the order of (and IDs of) each layer in the warehouse model
 */
export enum WarehouseModel {
    tray,
    column,
    shelf,
    bay,
    zone,
    warehouse
}

/**
 * Represents a tray expiry range
 */
export interface ExpiryRange {
    from: number;
    to: number;
    label: string;
}

/**
 * Represents a tray space within a column
 */
export interface TraySpace {
    column: Column;
    index: number;
}

/**
 * Represents a single tray size option
 */
export interface TraySize {
    label: string;
    sizeRatio: number;
}

/**
 * Represents a single tray category
 */
export interface Category {
    name: string;
    shortName: string | null;
}

/**
 * Mock warehouse zone colours
 */
const zoneColors = [
    {name: "Red", color: "#ff0000"},
    {name: "Green", color: "#00ff00"},
    {name: "Blue", color: "#0000ff"},
    {name: "White", color: "#ffffff"},
    {name: "Black", color: "#000000"}
];

/**
 * Mock warehouse tray expiries
 */
const trayExpiries: ExpiryRange[] = [
    {
        from: new Date(2020, 1).getTime(),
        to: new Date(2020, 2).getTime(),
        label: "Jan 2020"
    },
    {
        from: new Date(2020, 2).getTime(),
        to: new Date(2020, 3).getTime(),
        label: "Feb 2020"
    },
    {
        from: new Date(2020, 1).getTime(),
        to: new Date(2020, 4).getTime(),
        label: "Jan-Mar 2020"
    },
    {
        from: new Date(2020, 4).getTime(),
        to: new Date(2020, 7).getTime(),
        label: "Apr-Jun 2020"
    },
    {
        from: new Date(2020, 1).getTime(),
        to: new Date(2021, 1).getTime(),
        label: "2020"
    },
    {
        from: new Date(2021, 1).getTime(),
        to: new Date(2022, 1).getTime(),
        label: "2021"
    },
];

/**
 * Generate a random warehouse structure down to tray level
 * @async
 * @param id - The ID of the warehouse
 * @param name - The name of the new warehouse
 * @param randomMaxColumnHeight - Generate random maximum column heights per column
 */
async function generateRandomWarehouse(id: string, name: string, randomMaxColumnHeight = false): Promise<Warehouse> {
    const warehouse = await Warehouse.create(id, name).loadDepthFirst();
    for (const zoneColor of zoneColors) {
        const zone = Zone.create(zoneColor.name, zoneColor.color, warehouse);
        for (let j = 0; j < 3; j++) {
            const bay = Bay.create(j, String.fromCharCode(65 + j), zone);
            for (let k = 0; k < 3; k++) {
                const shelf = Shelf.create(k, `${k + 1}`, k === 1, bay);
                for (let l = 0; l < 4; l++) {
                    const maxHeight = randomMaxColumnHeight ? 2 + Math.round(3 * Math.random()) : 3,
                        column = Column.create(l, Utils.randItem(warehouse.traySizes), maxHeight, shelf);
                    for (let m = 0; m < 1 + Math.round((maxHeight - 2) * Math.random()); m++) {
                        Tray.create(column, m, Utils.randItem(warehouse.categories),
                            Utils.randItem(trayExpiries), Number((15 * Math.random()).toFixed(2)),
                            Math.random() < 0.1 ? "This is a custom field, it might be very long" : undefined);
                    }
                }
            }
        }
    }
    return warehouse;
}

/**
 * The active instances of the warehouses
 */
interface Warehouses {
    [id: string]: Warehouse;
}

export class WarehouseManager {
    private static readonly warehouses: Warehouses = {};

    public static get warehouseList(): Warehouse[] {
        return Object.values(this.warehouses);
    }

    /**
     * Load the warehouses
     */
    public static async loadWarehouses(): Promise<Warehouse[]> {
        if (ONLINE) {
            const warehouseDocuments: DatabaseDocument<unknown>[] = await firebase.database.loadCollection<unknown>("warehouses");
            for (const warehouseDocument of warehouseDocuments) {
                this.warehouses[warehouseDocument.id] =
                    Warehouse.createFromFields(warehouseDocument.id, warehouseDocument.fields);
            }
        } else {
            const warehouseNames = ["Chester-le-Street", "Durham", "Newcastle"];
            for (let i = 0; i < warehouseNames.length; i++) {
                const id = `MOCK_WAREHOUSE_${i}`;
                this.warehouses[id] = await generateRandomWarehouse(id, warehouseNames[i]);
            }
        }
        return this.warehouseList;
    }

    public static async loadWarehouse(warehouse: Warehouse): Promise<Warehouse> {
        return await warehouse.load(WarehouseModel.tray);
    }

    /**
     * Load a warehouse by its database ID
     * @async
     * @param id - The database ID of the warehouse to load
     * @returns The loaded warehouse
     */
    public static async loadWarehouseByID(id: string): Promise<Warehouse | undefined> {
        return typeof WarehouseManager.warehouses[id] === "undefined" ? undefined
                                                                      : this.loadWarehouse(this.warehouses[id]);
    }
}


export type TrayCell = Tray | TraySpace;
export {Warehouse} from "./WarehouseModel/Layers/Warehouse";
export {Zone} from "./WarehouseModel/Layers/Zone";
export {Bay} from "./WarehouseModel/Layers/Bay";
export {Shelf} from "./WarehouseModel/Layers/Shelf";
export {Column} from "./WarehouseModel/Layers/Column";
export {Tray} from "./WarehouseModel/Layers/Tray";
