import {faBackspace} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import {Dialog, DialogTitle} from "../core/Dialog";
import {User} from "../core/Firebase";
import {Category, ExpiryRange, Tray, TrayCell} from "../core/WarehouseModel";
import {KeyboardName, SimpleExpiryRange} from "../pages/ShelfViewPage";
import {buildKeyboardButtons, buildYearButtons} from "../utils/generateKeyboardButtons";
import {byNullSafe} from "../utils/sortsUtils";
import {CustomButtonProps, Keyboard} from "./Keyboard";
import "./styles/_bottompanel.scss";

export interface BottomPanelProps {
    openDialog: (dialog: Dialog) => void;

    keyboardState: KeyboardName;
    updateTrayProperties: (
        category: Category | null | undefined,
        expiry: SimpleExpiryRange | ExpiryRange | null | undefined,
        weight: string | null | undefined,
        couldAdvance: boolean,
    ) => void;
    removeSelection: () => void;

    categories: Category[];

    selectedTrayCells: TrayCell[];
    commonRange?: ExpiryRange;

    weight?: string;

    user: User;
}

type WeightKeyboardButton = "Next Tray" | "< Clear >" | "Backspace" | number | ".";

export const EXPIRY_GREY_RATIO = 0.8;
export const EXPIRY_GREY = "#ffffff";

/**
 * This class represents the enter bottom panel component.  This component manages the various BottomPanelPages.
 * @see BottomPanelPage
 */
export class BottomPanel extends React.Component<BottomPanelProps> {

    /**
     * Handles key presses clicked in the weight keyboard, by updating draftWeight in ShelfView
     * @param key
     */
    private weightKeyHandler(key: WeightKeyboardButton): void {

        if (key === "Next Tray") {
            this.props.updateTrayProperties(undefined, undefined, this.props.weight, true);
        } else if (key === "< Clear >") {
            this.props.updateTrayProperties(undefined, undefined, null, false);
        } else {
            // Must be a number or decimal point, just append
            // Unless it's only a zero, in which case we don't want a leading zero so just replace it. This deals
            // with overwriting the default 0 value too

            const newDraftWeight: string = (() => {
                if (key === "Backspace") {
                    return this.props.weight?.slice(0, -1) ?? "";
                } else if (this.props.weight === "0" && key !== ".") {
                    return `${key}`;
                } else {
                    return `${this.props.weight ?? ""}${key}`;
                }
            })();

            if (newDraftWeight === "") {
                this.props.updateTrayProperties(undefined, undefined, null, false);
            } else if (!isNaN(Number(newDraftWeight)) && newDraftWeight.length <= 6) {
                this.props.updateTrayProperties(undefined, undefined, newDraftWeight, false);
            }
        }
    }


    /**
     * Return different keyboards depending on keyboardState
     * @param disabled whether the keyboard is disabled (ie no trays are selected)
     */
    private chooseKeyboard(disabled: boolean): React.ReactNode {

        // We are passed all of the selected TrayCells, only want to consider the actual Trays (not TraySpaces)
        const traysOnly: Tray[] = this.props.selectedTrayCells.filter((a): a is Tray => a instanceof Tray);

        const firstCat = traysOnly.find(i => i !== undefined)?.category?.name;
        const commonCat = firstCat !== undefined && traysOnly.every(item => item.category?.name === undefined || item.category.name === firstCat)
                          ? firstCat : null;


        // TODO: consider applying database settings to this

        const {
            categories,
            years,
            quarters,
            months
        } = buildKeyboardButtons(4, 4, this.props.categories);

        const categoryGroups: Map<string, [Category]> = new Map();
        this.props.categories.forEach(cat => {
            if (cat.group !== null) {
                if (categoryGroups.has(cat.group)) {
                    categoryGroups.get(cat.group)?.push(cat);
                } else {
                    categoryGroups.set(cat.group, [cat]);
                }
            }
        });

        const buttonsWithoutGroups = this.props.categories.filter(cat =>
            cat.group === null
        ).map((cat): CustomButtonProps => ({
            name: cat.shortName ?? cat.name,
            onClick: this.props.updateTrayProperties.bind(undefined, cat, null, null, true),
            selected: cat.name === commonCat,
        }));

        const groupedButtons = Array.from(categoryGroups.entries()).map(([group, categories]) => ({
            name: group,
            onClick: this.props.openDialog.bind(undefined, {
                dialog: (close: () => void) => {
                    const groupButtons = categories.map((cat) => ({
                        name: cat.shortName ?? cat.name,
                        onClick: () => {
                            this.props.updateTrayProperties.bind(undefined,
                                cat,
                                null,
                                null,
                                true
                            );
                            close();
                        },
                        selected: cat.name === commonCat
                    }));
                    return <GroupedCategoriesDialog
                        groupTitle={group}
                        categoryButtons={groupButtons}
                        close={close}/>;
                },
                closeOnDocumentClick: true,
            }),
            selected: commonCat ? categories.some(cat => cat.name === commonCat) : false
        }));

        const categoryButtons: CustomButtonProps[] = buttonsWithoutGroups
            .concat(groupedButtons)
            .sort(byNullSafe(button => button.name));

        const specialButtons: CustomButtonProps[] = [
            {
                name: "< Clear >",
                onClick: this.props.removeSelection,
                selected: false,
                bg: "#ffffff"
            }
        ];

        const allCategoryButtons = categoryButtons.concat(specialButtons);

        if (this.props.keyboardState === "category") {

            return <Keyboard
                id="cat-keyboard"
                disabled={disabled}
                buttons={allCategoryButtons}
                gridX={7}
            />;

        } else if (this.props.keyboardState === "expiry") {
            // todo this might be worth making a setting for; it's the kind of thing someone might want to disable for
            //  performance on low-end devices
            // this.highlightExpiryKey();



            return <div className="keyboard-container expiry-container">
                <Keyboard id="exp-special" disabled={disabled} buttons={specialButtons} gridX={1}/>
                <Keyboard id="exp-years" disabled={disabled} buttons={years} gridX={2}/>
                <Keyboard id="exp-quarters" disabled={disabled} buttons={months} gridX={2}/>
                <Keyboard id="exp-months" disabled={disabled} buttons={quarters} gridX={3}/>
            </div>;

        } else if (this.props.keyboardState === "weight") {

            // Create numpad for the digits and decimal point buttons

            const numpad: WeightKeyboardButton[] = [7, 8, 9, 4, 5, 6, 1, 2, 3, 0, "."];
            const numpadButtons = numpad.map((a) => ({
                name: a.toString(),
                onClick: () => this.weightKeyHandler(a),
                disabled: this.props.selectedTrayCells.length === 0,
            }));

            // Create numpadSide for the side buttons
            const numpadSide: CustomButtonProps[] = ([
                "Backspace", "< Clear >"
            ].concat(this.props.user.autoAdvanceMode ? ["Next Tray"] : []) as WeightKeyboardButton[])
                .map((a) => ({
                    name: a.toString(),
                    icon: a === "Backspace" ? faBackspace : undefined,
                    disabled: this.props.selectedTrayCells.length === 0,
                    onClick: () => this.weightKeyHandler(a),
                    bg: a === "< Clear >" ? "#ffffff" : undefined
                }));

            return <div className="keyboard-container weight-container">
                <Keyboard id="weight-numpad" buttons={numpadButtons} gridX={3}/>
                <div id="numpadR">
                    <Keyboard buttons={numpadSide} gridX={1}/>
                </div>
            </div>;

        } else if (this.props.keyboardState === "custom") {

            return <div style={{
                display: "grid",
            }}>{
                (!this.props.user.customKeyboard) || this.props.user.customKeyboard.buttons.length === 0 ? <div>
                    The keyboard has no buttons
                </div> : this.props.user.customKeyboard.buttons.map((button, index) => <button
                    key={index}
                    style={{
                        fontSize: 14,
                        margin: 2,
                        gridColumnStart: button.columnStart ?? undefined,
                        gridColumnEnd: button.columnEnd ?? undefined,
                        gridRowStart: button.rowStart ?? undefined,
                        gridRowEnd: button.rowEnd ?? undefined,
                        background: button.background ?? undefined
                    }}
                    onClick={this.props.updateTrayProperties.bind(undefined,
                        button.setting.category,
                        button.setting.expiry,
                        null,
                        true
                    )}
                >
                    {button.label}
                </button>)

            }</div>;

        } else { // edit shelf
            return <div>
                Unimplemented Panel
            </div>;
        }

    }


// /** todo fixme reintroduce this within the new system
    //  * Highlight the key corresponding to the current selection
    //  */
    // private highlightExpiryKey(): void {
    //     // this isn't the best way to do this but it's more performant than other options
    //     const isYear = this.props.commonRange?.label.length === 4;
    //     const isMonth = this.props.commonRange?.label.length === 8;
    //     const isQuarter = !isYear && !isMonth;
    //
    //     for (const year of this.years) {
    //         year.selected = isYear && year.expiryFrom === this.props.commonRange?.from;
    //     }
    //     for (const month of this.months) {
    //         month.selected = isMonth && month.expiryFrom === this.props.commonRange?.from;
    //     }
    //     for (const quarter of this.quarters) {
    //         quarter.selected = isQuarter && quarter.expiryFrom === this.props.commonRange?.from;
    //     }
    // }

    /**
     * @inheritDoc
     */
    render(): React.ReactNode {
        // return DOM elements using button structures
        return <div id="bottom">
            {this.chooseKeyboard(!this.props.selectedTrayCells.length)}
        </div>;
    }
}

interface GroupedCategoriesDialogProps {
    groupTitle: string;
    categoryButtons: CustomButtonProps[];
    close: () => void;
}

/**
 * This is the the content of the dialog which is shown when the comment on a tray is being edited
 */
class GroupedCategoriesDialog extends React.Component<GroupedCategoriesDialogProps> {
    render(): React.ReactElement {
        return <>
            <DialogTitle title={this.props.groupTitle.toUpperCase()}/>
            <div className="dialogContent" style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr"
            }}>{
                this.props.categoryButtons.map((cat, index) =>
                    <button onClick={cat.onClick} key={index}>{cat.name}</button>
                )
            }</div>
        </>;
    }
}
