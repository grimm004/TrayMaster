import {UpperLayer} from "./UpperLayer";
import {Shelf} from "./Shelf";
import {Bay} from "./Bay";
import {Zone} from "./Zone";
import {Warehouse} from "./Warehouse";
import {Tray, TraySize} from "./Tray";
import {ONLINE, TrayCell, TraySpace} from "../WarehouseModel";
import {Utils} from "./Utils";


export class Column extends UpperLayer {
    /**
     * This stores the tray spaces.  The tray spaces must be stored and not rebuild each time because otherwise the two
     * different object would be different keys of the selection map
     */
    private static traySpaces: Map<Column, TraySpace[]> = new Map();

    index: number;
    size?: TraySize;
    maxHeight?: number;

    parentShelf?: Shelf;
    trays: Tray[] = [];

    /**
     * @param location - The database location of the column
     * @param index - The (ordered) index of the column within the shelf
     * @param size - The size of the tray
     * @param maxHeight - The maximum number of trays that can be placed in this column
     * @param parentShelf - The (nullable) parent shelf
     */
    private constructor(location: string, index: number, size?: TraySize, maxHeight?: number, parentShelf?: Shelf) {
        super(location);
        this.index = index;
        this.size = size;
        this.maxHeight = maxHeight;

        this.parentShelf = parentShelf;
    }

    /**
     * Create a column from a collection of trays
     * @param trays - The trays to put in the column
     * @param index - The index of the column within its shelf
     * @param size - The column size
     * @param maxHeight - The max number of trays that can go in this column
     * @param parentShelf - The shelf the column belongs to
     * @returns The newly created column
     */
    public static create(
        trays: Tray[],
        index?: number,
        size?: TraySize,
        maxHeight?: number,
        parentShelf?: Shelf
    ): Column {
        const column: Column = new Column(Utils.generateRandomId(), index ?? -1, size, maxHeight, parentShelf);
        column.trays = trays;
        for (let i = 0; i < column.trays.length; i++)
            column.trays[i].placeInColumn(i, column);
        return column;
    }

    /**
     * Place the column within a shelf
     * @param index - The index of the column within the shelf
     * @param parentShelf - The shelf the column is being added to
     */
    public placeInShelf(index: number, parentShelf: Shelf) {
        this.index = index;
        this.parentShelf = parentShelf;
    }

    public async saveLayer(): Promise<void> {

    }

    /**
     * Load all columns within a given column
     * @async
     * @param shelf - The shelf to load the columns for
     * @returns A promise which resolves to all columns within the shelf
     */
    public static async loadColumns(shelf: Shelf): Promise<Column[]> {
        if (ONLINE) {
            const columns: Column[] = await this.loadChildObjects<Column, Shelf>(shelf, "columns", "index");
            for (let column of columns) {
                column.trays = await Tray.loadTrays(column);
                column.isDeepLoaded = true;
            }
            return columns;
        } else {
            const columns: Column[] = [],
                colNumber = shelf.index % 2 === 0 ? 4 : 2;

            for (let i = 0; i < colNumber; i++) {
                const sizes = shelf.parentWarehouse?.traySizes!!,
                    size: TraySize = sizes[Math.floor(Math.random() * sizes.length)],
                    maxHeight = shelf.index % 2 === 0 ? Math.floor(Math.random() * 8 + 2)
                                                      : Math.random() < 0.5 ? 2
                                                                            : 10;

                const column: Column = new Column(Utils.generateRandomId(), i, size, maxHeight, shelf);
                column.trays = await Tray.loadTrays(column);
                column.isDeepLoaded = true;
                columns.push(column);
            }
            return columns;
        }
    }

    /**
     * Load all columns (without any trays) in a shelf
     * @async
     * @param shelf - The shelf to load the columns for
     * @returns A promise which resolves to the flat column list
     */
    public static async loadFlatColumns(shelf: Shelf): Promise<Column[]> {
        if (ONLINE)
            return await this.loadChildObjects<Column, Shelf>(shelf, "columns", "index");
        else {
            const columns: Column[] = [],
                colNumber = shelf.index % 2 === 0 ? 4 : 2;

            for (let i = 0; i < colNumber; i++) {
                const sizes = shelf.parentWarehouse?.traySizes!!,
                    size: TraySize = sizes[Math.floor(Math.random() * sizes.length)],
                    maxHeight = shelf.index % 2 === 0 ? Math.floor(Math.random() * 8 + 2)
                                                      : Math.random() < 0.5 ? 2
                                                                            : 10;

                columns.push(new Column(Utils.generateRandomId(), i, size, maxHeight, shelf));
            }
            return columns;
        }
    }

    /**
     * Load the trays into the column
     * @async
     */
    public async loadNextLayer(): Promise<void> {
        if (!this.isDeepLoaded)
            this.trays = await Tray.loadTrays(this);
        this.isDeepLoaded = true;
    }

    //#region Parent Getters
    get parentBay(): Bay | undefined {
        return this.parentShelf?.parentBay;
    }

    get parentZone(): Zone | undefined {
        return this.parentBay?.parentZone;
    }

    get parentWarehouse(): Warehouse | undefined {
        return this.parentZone?.parentWarehouse;
    }

    //#endregion

    /**
     * This method pads the tray arrays of a column with TraySpaces such that the the length of the returned array is
     * the max height of the column.  If the column has an undefined max height, it is padded with the specified value.
     * This method stores the tray spaces that are added in the traySpaces field such that the same TraySpace object is
     * always returned.  The same object being returned is important if it is going to be used as the key of a map.
     * @param ifNoMaxHeight The padding to add if maxHeight is empty
     * @return The padded array.
     */
    getPaddedTrays(ifNoMaxHeight: number = 1): TrayCell[] {

        const missingTrays = this.maxHeight ? Math.max(0, this.maxHeight - this.trays.length)
                                            : 1;

        const existing: TraySpace[] | undefined = Column.traySpaces.get(this);
        if (existing) {

            if (existing.length === missingTrays) {

                return (this.trays as TrayCell[]).concat(existing);

            } else if (existing.length > missingTrays) { // there are too many missing trays

                const newSpaces = existing.filter(space => space.index >= this.trays.length);

                Column.traySpaces.set(this, newSpaces);
                return (this.trays as TrayCell[]).concat(newSpaces);
            } else { // there are not enough tray spaces

                const traysToAdd = missingTrays - existing.length;
                const newSpaces = Array(traysToAdd).fill(0).map((_, index) => {
                        return ({column: this, index: this.trays.length + index} as TraySpace);
                    }
                ).concat(existing);

                Column.traySpaces.set(this, newSpaces);
                return (this.trays as TrayCell[]).concat(newSpaces);
            }

        } else { // build tray spaces

            const newSpaces = Array(missingTrays).fill(0).map((_, index) => {
                    return {column: this, index: this.trays.length + index};
                }
            );
            Column.traySpaces.set(this, newSpaces);

            return (this.trays as TrayCell[]).concat(newSpaces);

        }

    }


    /**
     * This method clears the padded spaces, this can be used to reset empty spaces or otherwise to clear up memory
     * which will no longer be used.  If a column is passed then only that column is purged otherwise all columns are.
     */
    static purgePaddedSpaces(column?: Column) {
        if (column) {
            Column.traySpaces.delete(column);
        } else {
            Column.traySpaces.clear();
        }
    }
}