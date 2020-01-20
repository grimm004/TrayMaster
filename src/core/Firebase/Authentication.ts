import * as fb from "firebase/app";
import "firebase/auth";
import Utils from "../WarehouseModel/Utils";
import {DatabaseObject} from "./DatabaseObject";
import {DatabaseCollection} from "./DatabaseCollection";
import {FirebaseError} from "./FirebaseError";
import {Warehouse} from "../WarehouseModel/Layers/Warehouse";
import {WarehouseManager} from "../WarehouseModel";

type Auth = fb.auth.Auth;

export class AuthenticationError extends FirebaseError {
}

interface UserWarehouseSettings {
    testUserWarehouseSetting: string;
}

interface UserFields {
    isAdmin: boolean;
    name: string;
    lastWarehouseID: string;
}

export class User extends DatabaseObject<UserFields> {
    private warehouseSettings: DatabaseCollection<UserWarehouseSettings>;

    public constructor(id: string, fields?: UserFields) {
        super(id, fields ?? {isAdmin: false, name: "", lastWarehouseID: ""});
        this.warehouseSettings = new DatabaseCollection<UserWarehouseSettings>(Utils.joinPaths("users", id, "warehouses"));
    }

    public async load(forceLoad = false): Promise<this> {
        await this.warehouseSettings.load(forceLoad);
        return super.load(forceLoad);
    }

    public async stage(forceStage = false, commit = false): Promise<void> {
        await this.warehouseSettings.stage(forceStage);
        super.stage(forceStage, commit);
    }

    public get accessibleWarehouses(): Warehouse[] {
        const accessibleWarehouses: Warehouse[] = [];
        for (const warehouse of WarehouseManager.warehouseList) {
            if (this.warehouseSettings.idList.includes(warehouse.id)) {
                accessibleWarehouses.push(warehouse);
            }
        }
        return accessibleWarehouses;
    }

    public get lastWarehouseID(): string | null {
        return this.fields.lastWarehouseID === "" ? null : this.fields.lastWarehouseID;
    }

    public set lastWarehouseID(lastWarehouseID: string | null) {
        this.fields.lastWarehouseID = lastWarehouseID ?? "";
    }

    public get collectionPath(): string {
        return "users";
    }

    public get isAdmin(): boolean {
        return this.fields.isAdmin;
    }

    public get name(): string {
        return this.fields.name;
    }

    public set name(name: string) {
        this.fields.name = name;
    }
}

export class Authentication {
    public readonly auth: Auth;
    public onSignIn?: (user: User) => void;
    public onSignOut?: () => void;
    public currentUser?: User;

    public constructor() {
        this.auth = fb.auth();
        this.auth.onAuthStateChanged(async userSnapshot => {
            if (userSnapshot) {
                this.currentUser = await new User(userSnapshot.uid).load();
                this.onSignIn?.call(this, this.currentUser);
            } else {
                this.currentUser = undefined;
                this.onSignOut?.call(this);
            }
        });
    }

    public async signUp(email: string, password: string): Promise<void> {
        if (!Utils.isEmailValid(email)) {
            throw new AuthenticationError("Invalid email");
        }
        if (password.length < 8) {
            throw new AuthenticationError("Password length must be five characters or more.");
        }
        if (password.toLowerCase() !== password) {
            throw new AuthenticationError("Password must contain at least one lower and upper case character.");
        }
        await this.auth.createUserWithEmailAndPassword(email, password);
    }

    public async signIn(email: string, password: string): Promise<void> {
        if (!Utils.isEmailValid(email)) {
            throw new AuthenticationError("Invalid email");
        }
        await this.auth.signInWithEmailAndPassword(email, password);
    }

    public async signOut(): Promise<void> {
        await this.auth.signOut();
    }

    public get isSignedIn(): boolean {
        return this.auth.currentUser !== null;
    }
}