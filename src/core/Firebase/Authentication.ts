import * as fb from "firebase/app";
import "firebase/auth";
import {ONLINE} from "../Firebase";
import {WarehouseManager} from "../WarehouseModel";
import {Warehouse} from "../WarehouseModel/Layers/Warehouse";
import Utils from "../WarehouseModel/Utils";
import {DatabaseCollection} from "./DatabaseCollection";
import {DatabaseObject} from "./DatabaseObject";
import {FirebaseError} from "./FirebaseError";

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

    enableAutoAdvance: boolean;
    onlySingleAutoAdvance: boolean;
}

export class User extends DatabaseObject<UserFields> {
    private warehouseSettings: DatabaseCollection<UserWarehouseSettings>;

    public constructor(id: string, fields?: UserFields) {
        super(id, fields ?? {
            isAdmin: false,
            name: "",
            lastWarehouseID: "",
            enableAutoAdvance: false,
            onlySingleAutoAdvance: false
        });
        this.warehouseSettings = new DatabaseCollection<UserWarehouseSettings>(Utils.joinPaths("users", id, "warehouses"), false);
    }

    public async load(forceLoad = false): Promise<User> {
        if (ONLINE) {
            await this.warehouseSettings.load(forceLoad);
            return super.load(forceLoad);
        } else {
            this.warehouseSettings.add({testUserWarehouseSetting: "MOCK"}, "MOCK_WAREHOUSE_0");
            this.warehouseSettings.add({testUserWarehouseSetting: "MOCK"}, "MOCK_WAREHOUSE_1");
            return this;
        }
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

    public get enableAutoAdvance(): boolean {
        return this.fields.enableAutoAdvance;
    }

    public set enableAutoAdvance(enableAutoAdvance: boolean) {
        this.fields.enableAutoAdvance = enableAutoAdvance;
    }


    public get onlySingleAutoAdvance(): boolean {
        return this.fields.onlySingleAutoAdvance;
    }

    public set onlySingleAutoAdvance(onlySingleAutoAdvance: boolean) {
        this.fields.onlySingleAutoAdvance = onlySingleAutoAdvance;
    }

}

export class Authentication {
    public readonly auth: Auth;
    public currentUser?: User;

    private onSignIn?: (user: User) => void;
    private onSignOut?: () => void;

    public constructor() {
        this.auth = fb.auth();
        if (!ONLINE) {
            this.auth.setPersistence(fb.auth.Auth.Persistence.NONE).catch(error => console.log(error));
        }
    }

    public async registerListeners(onSignIn?: (user: User) => void, onSignOut?: () => void): Promise<void> {
        this.onSignIn = onSignIn;
        this.onSignOut = onSignOut;
        if (ONLINE) {
            this.auth.onAuthStateChanged(async userSnapshot => {
                if (userSnapshot) {
                    this.currentUser = await new User(userSnapshot.uid).load();
                    onSignIn?.call(this, this.currentUser);
                } else {
                    this.currentUser = undefined;
                    onSignOut?.call(this);
                }
            });
        } else {
            this.currentUser = await new User("MOCK_USER",
                {
                    name: "Mock User",
                    lastWarehouseID: "MOCK_WAREHOUSE_0",
                    isAdmin: true,
                    enableAutoAdvance: false,
                    onlySingleAutoAdvance: false
                }).load();
            onSignIn?.call(this, this.currentUser);
        }
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
        if (ONLINE) {
            await this.auth.createUserWithEmailAndPassword(email, password);
        } else {
            this.currentUser = await new User("MOCK_USER",
                {
                    name: "Mock User",
                    lastWarehouseID: "",
                    isAdmin: true,
                    enableAutoAdvance: false,
                    onlySingleAutoAdvance: false
                }).load();
            this.onSignIn?.call(this, this.currentUser);
        }
    }

    public async signIn(email: string, password: string): Promise<void> {
        if (!Utils.isEmailValid(email)) {
            throw new AuthenticationError("Invalid email");
        }
        if (ONLINE) {
            await this.auth.signInWithEmailAndPassword(email, password);
        } else {
            this.currentUser = await new User("MOCK_USER",
                {
                    name: "Mock User",
                    lastWarehouseID: "",
                    isAdmin: true,
                    enableAutoAdvance: false,
                    onlySingleAutoAdvance: false
                }).load();
            this.onSignIn?.call(this, this.currentUser);
        }
    }

    public async signOut(): Promise<void> {
        if (ONLINE) {
            await this.auth.signOut();
        } else {
            this.onSignOut?.call(this);
        }
    }

    public get isSignedIn(): boolean {
        return this.auth.currentUser !== null;
    }
}