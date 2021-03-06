import {isEqual} from "lodash";
import firebase from "../Firebase";
import Utils from "../WarehouseModel/Utils";

export abstract class DatabaseObject<TFields> {
    public readonly id: string;
    public loaded: boolean;

    protected fields: TFields;
    protected originalFields?: TFields;

    protected constructor(id: string, fields: TFields) {
        this.fields = fields;
        this.loaded = false;
        this.id = id;
    }

    /**
     * The database path of the object
     */
    public get path(): string {
        return Utils.joinPaths(this.collectionPath, this.id);
    }

    /**
     * The database path of the collection the object belongs to
     */
    public abstract get collectionPath(): string;

    public async load(forceLoad = false): Promise<this> {
        if (!this.loaded || forceLoad) {
            this.fields = (await firebase.database.loadDocument<TFields>(this.path))?.fields ?? this.fields;
            this.originalFields = {
                ...this.fields,
            };
            this.loaded = true;
        }
        return this;
    }

    public async stage(forceStage = false, commit = false): Promise<void> {
        if (this.changed || forceStage) {
            firebase.database.set(this.path, this.fields);
            this.originalFields = Object.assign({}, this.fields);
        }
        if (commit) {
            await firebase.database.commit();
        }
    }

    public async delete(commit = false): Promise<void> {
        firebase.database.delete(this.path);

        if (commit) {
            await firebase.database.commit();
        }
    }

    protected get changed(): boolean {
        return !isEqual(this.fields, this.originalFields);
    }

    public fieldsSaved(): void {
        this.originalFields = Object.assign({}, this.fields);
    }
}