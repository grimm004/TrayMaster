import {faInfoCircle} from "@fortawesome/free-solid-svg-icons";
import classNames from "classnames";
import {cloneDeep, isEqual} from "lodash";
import React from "react";
import {User} from "../core/Firebase";
import {Category, WarehouseModel} from "../core/WarehouseModel";
import {SettingsTab} from "../pages/SettingsPage";
import {Dialog, DialogButtons, DialogTitle} from "./Dialog";

import "./styles/_categoryeditor.scss";


interface CategoryEditorProps {
    openDialog: (dialog: Dialog) => void;
    categories: Category[];
    user: User;

    setLock: (lockFunction: (tab: SettingsTab) => boolean) => void;

    addCategory: (category: Category) => void;
    removeCategory: (category: Category) => void;
    editCategory: (id: string, category: Category) => void;
    getCategoryID: (category?: Category) => string;
    stage: (forceStage?: boolean, commit?: boolean, minLayer?: WarehouseModel) => Promise<void>;

    updatePage: () => void;
}


interface CategoryEditorState {
    oldCat?: Category;
    draftCat?: Category;
}

/**
 * This class displays all categories in the warehouse, lets the user
 * edit and delete existing categories, and add new ones
 */

export class CategoryEditor extends React.Component<CategoryEditorProps, CategoryEditorState> {

    private static readonly DEFAULT_NAME = "Unnamed";

    private static readonly BLANK_CATEGORY: Category = {
        index: -1,
        name: "",
        shortName: null,
        underStockThreshold: 0,
        overStockThreshold: 100,
        type: "custom",
        group: null
    };

    constructor(props: CategoryEditorProps) {
        super(props);

        this.state = {
            oldCat: undefined,
            draftCat: undefined
        };

        this.props.setLock((_: SettingsTab) => {
            const hasUnsavedChanges = this.hasUnsavedChanges();
            if (hasUnsavedChanges) {
                this.props.openDialog(this.createUnsavedDialog());
            }
            return hasUnsavedChanges;
        });
    }

    /**
     * Is called when user selects a category in the list
     * Changes state values to display corresponding category
     * in editor
     * @param cat
     */
    private selectCategory(cat: Category): void {
        if (this.hasUnsavedChanges()) {
            this.props.openDialog(this.createUnsavedDialog());
        } else {
            this.setState((state) => ({
                ...state,
                oldCat: cat,
                draftCat: cloneDeep(cat)
            }));
        }
    }

    /**
     * Creates the right-hand side of the screen
     * Displays content of categories and allows user to edit them
     */
    private renderEditPanel(): React.ReactNode {

        if (this.state.draftCat) {
            return <>
                <div id="cat-edit-controls">
                    <div id="cat-edit-header">
                        <h2>{this.state.oldCat ? `Edit ${this.state.oldCat.name}${this.hasUnsavedChanges() ? "*" : ""}`
                                               : "New Category"}</h2>
                        <div>
                            <button
                                onClick={this.discardChanges.bind(this)}
                            >Discard Changes
                            </button>
                            <button
                                disabled={!this.hasUnsavedChanges()}
                                onClick={this.hasUnsavedChanges() ? this.saveCategory.bind(this) : undefined}
                            >Save Changes
                            </button>
                        </div>
                    </div>
                    <h3>Name</h3>
                    <input
                        type="text"
                        value={this.state.draftCat.name}
                        placeholder="Unnamed"
                        onChange={e => {
                            const newName = e.target.value;
                            this.setState(state => {
                                if (state.draftCat) {
                                    state.draftCat.name = newName;
                                }
                                return state;
                            });
                        }}
                    />
                    <h3>Short Name</h3>
                    <input
                        type="text"
                        value={this.state.draftCat.shortName ?? ""}
                        onChange={e => {
                            const newShortName = e.target.value.length === 0 ? null : e.target.value;
                            this.setState(state => {
                                if (state.draftCat) {
                                    state.draftCat.shortName = newShortName;
                                }
                                return state;
                            });
                        }}
                    />
                    {/*<button onClick={_ => {
                        this.setState(state => {
                            if (state.draftCat) {
                                state.draftCat.shortName = state.draftCat.name;
                            }
                            return state;
                        });
                    }}>Copy From Name
                    </button>*/}
                    <h3>Under-Stock Threshold</h3>
                    <input
                        type="number"
                        min="0"
                        max={this.state.draftCat.overStockThreshold ?? undefined}
                        value={this.state.draftCat.underStockThreshold ?? ""}
                        placeholder={"No threshold"}
                        onChange={e => {
                            const newUnderStock = e.target.value.length === 0 ? null
                                                                              : Number(e.target.value);
                            this.setState(state => {
                                if (state.draftCat) {
                                    state.draftCat.underStockThreshold = newUnderStock;
                                }
                                return state;
                            });
                        }}
                    /> trays
                    <h3>Over-Stock Threshold</h3>
                    <input
                        type="number"
                        min={this.state.draftCat.underStockThreshold ?? undefined}
                        value={this.state.draftCat.overStockThreshold ?? ""}
                        placeholder={"No threshold"}
                        onChange={e => {
                            const newOverstock = e.target.value.length === 0 ? null
                                                                             : Number(e.target.value);
                            this.setState(state => {
                                if (state.draftCat) {
                                    state.draftCat.overStockThreshold = newOverstock;
                                }
                                return state;
                            });
                        }}
                    /> trays
                    <h3>Group Title</h3>
                    <input
                        type="text"
                        value={this.state.draftCat.group ?? ""}
                        onChange={(e) => {
                            const newGroup = e.target.value.length === 0 ? null : e.target.value;
                            this.setState(state => {
                                if (state.draftCat) {
                                    state.draftCat.group = newGroup;
                                }
                                return state;
                            });
                        }}
                    />
                </div>
                <div id="cat-edit-bottom-btns">
                    <button
                        disabled={this.state.oldCat?.type === "default"}
                        onClick={this.deleteCategory.bind(this)}
                    >Delete This Category
                    </button>
                    {this.state.oldCat?.type === "default" ? <div id="del-msg">You cannot delete a default
                        category!</div> : null}
                </div>
            </>;
        } else {
            return <div>Select a category on the left, or add a new one!</div>;
        }

    }

    /**
     * Is called if user clicks button to add a new category
     */
    private newCategory(): void {

        if (this.hasUnsavedChanges()) {
            this.props.openDialog(this.createUnsavedDialog());
        } else {
            this.setState(state => ({
                ...state,
                oldCat: undefined,
                draftCat: cloneDeep(CategoryEditor.BLANK_CATEGORY)
            }));
        }
    }

    /**
     * Checks if any of the fields in the currently displayed category has changed
     */
    hasUnsavedChanges(): boolean {
        return !isEqual(this.state.draftCat, CategoryEditor.BLANK_CATEGORY) && !isEqual(this.state.oldCat, this.state.draftCat);
    }

    /**
     *Saves changes to categories, doesn't let user save category with empty name
     */
    private async saveCategory(): Promise<void> {
        if (this.state.draftCat) {

            const newCategory = cloneDeep(this.state.draftCat); // to avoid altering the state here
            if (newCategory.name.length === 0) {
                newCategory.name = CategoryEditor.DEFAULT_NAME;
            }

            if (this.state.oldCat) {
                this.props.editCategory(this.props.getCategoryID(this.state.oldCat), newCategory);

                this.setState(state => ({
                    ...state,
                    oldCat: newCategory,
                    draftCat: cloneDeep(newCategory)
                }));
            } else {
                newCategory.index = this.props.categories.length;
                this.setState(state => ({
                    ...state,
                    oldCat: newCategory,
                    draftCat: cloneDeep(newCategory)
                }));
                this.props.addCategory(newCategory);
            }
            this.props.updatePage();
            await this.props.stage(true, true);

        }
    }

    private discardChanges(): void {
        this.setState(state => ({
            ...state,
            oldCat: undefined,
            draftCat: undefined
        }));
    }

    /**
     * Deletes category, makes sure indices inside object matches actual
     * indices after removing one category
     */
    private deleteCategory(): void {

        // todo fixme Not sure who wrote this - this needs checking for correctness. Does it definitely re-sync all
        // indices changes to DB? Surely the adjustments happen in the then, which occurs afterwards?

        if (this.state.oldCat && this.state.draftCat?.type !== "default") {
            this.props.removeCategory(this.state.oldCat);
            this.props.stage(true, true).then(() => {
                    if (this.state.oldCat && this.state.oldCat.index !== this.props.categories.length - 1) {
                        this.props.updatePage();
                        for (let j = this.state.oldCat.index; j < this.props.categories.length - 1; j++) {
                            const category = this.props.categories[j];
                            const id = this.props.getCategoryID(category);
                            category.index = j;
                            this.props.editCategory(id, category);
                        }
                    }
                    this.setState(state => ({
                        ...state,
                        oldCat: undefined,
                        draftCat: undefined
                    }));
                    this.props.updatePage();
                }
            );
        }
    }


    render(): React.ReactNode {

        return <div id="category-editor">
            <div id="category-sidebar">
                <div id="category-list">
                    {this.props.categories.map((cat, index) => <div
                        className={classNames("category-list-item", {
                            "cat-selected": isEqual(this.state.oldCat, cat)
                        })}
                        key={index}
                        onClick={this.selectCategory.bind(this, cat)}>
                        {cat.name}
                    </div>)}
                </div>
                <button id="add-cat-btn" onClick={this.newCategory.bind(this)}>New Category</button>
            </div>
            <div id="cat-edit-main">
                {this.renderEditPanel()}
            </div>
        </div>;
    }

    /**
     * Returns the unsaved changes dialog
     */
    private createUnsavedDialog(): Dialog {
        return {
            closeOnDocumentClick: true,
            dialog: (close: () => void) => <>
                <DialogTitle title="Unsaved Changes" iconProps={{icon: faInfoCircle, color: "blue"}}/>
                <div className="dialogContent">
                    <h2>Please save or discard your current changes before proceeding</h2>
                    <DialogButtons buttons={[
                        {name: "OK", buttonProps: {onClick: close}}
                    ]}/>
                </div>
            </>
        };
    }

}