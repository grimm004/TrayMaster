import {faBackspace} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import {User} from "../core/Firebase/Authentication";
import {Category, ExpiryRange, Tray, TrayCell} from "../core/WarehouseModel";

import {KeyboardName} from "../pages/ShelfViewPage";
import {Keyboard, KeyboardButtonProps} from "./Keyboard";


export interface BottomPanelProps {
    keyboardState: KeyboardName;
    categorySelected: (category: Category | null) => void;
    expirySelected: (expiry: ExpiryRange | null) => void;

    categories: Category[];

    selectedTrayCells: TrayCell[];

    weight?: string;
    setWeight: (weight: string | undefined, couldAdvance: boolean) => void;

    user: User;

}

interface BottomPanelState {
    selectedYear: number | undefined;
}

type WeightKeyboardButton = "Next" | "Clear" | "Backspace" | number | ".";

/**
 * This class represents the enter bottom panel component.  This component manages the various BottomPanelPages.
 * @see BottomPanelPage
 */
export class BottomPanel extends React.Component<BottomPanelProps, BottomPanelState> {
    private readonly years: KeyboardButtonProps[];
    private readonly quarters: KeyboardButtonProps[];
    private readonly months: KeyboardButtonProps[];
    private readonly quartersTranslator: string[] = [
        "Jan-Mar",
        "Apr-Jun",
        "Jul-Sep",
        "Oct-Dec"
    ];
    private readonly monthsTranslator: string[] = [
        "Jan", "Feb", "Mar",
        "Apr", "May", "Jun",
        "Jul", "Aug", "Sep",
        "Oct", "Nov", "Dec"
    ];

    constructor(props: BottomPanelProps) {
        super(props);

        // Expiry keyboard structure
        this.years = [];
        // TODO: consider applying database settings to this
        const thisYear = new Date().getFullYear();
        for (let i = thisYear; i < thisYear + 8; i++) {
            this.years.push({
                name: i.toString(), onClick: () => {
                    this.selectYear(i);
                }
            });
        }

        this.quarters = [];
        for (let i = 0; i < 4; i++) {
            this.quarters.push({
                name: this.quartersTranslator[i], onClick: () => {
                    this.selectQuarter(i);
                }
            });
        }

        this.months = [];
        for (let i = 0; i < 12; i++) {
            this.months.push({
                name: this.monthsTranslator[i], onClick: () => {
                    this.selectMonth(i);
                }
            });
        }
    }

    /**
     * Handles key presses clicked in the weight keyboard, by updating draftWeight in ShelfView
     * @param key
     */
    private weightKeyHandler(key: WeightKeyboardButton): void {

        if (key === "Next") {
            this.props.setWeight(this.props.weight, true);
        } else if (key === "Clear") {
            this.props.setWeight(undefined, false);
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
                this.props.setWeight(undefined, false);
            } else if (!isNaN(Number(newDraftWeight)) && newDraftWeight.length <= 6) {
                this.props.setWeight(newDraftWeight, false);
            }
        }
    }

    /**
     * Called when a year button is pressed
     * Sets selectedYear and current tray expiry to that year
     * @param year - number representing the current year
     */
    private selectYear(year: number): void {
        this.setState(state => ({
            ...state,
            selectedYear: year
        }));

        const from = new Date(year, 0).getTime();
        const to = new Date(year + 1, 0).getTime();

        this.props.expirySelected({
            from: from,
            to: to,
            label: year.toString()
        });
    }

    /**
     * Called when a quarter button is pressed
     * Sets current tray expiry to that quarter in selectedYear
     * @param quarter - number in [0-3] inclusive representing the current quarter
     */
    private selectQuarter(quarter: number): void {
        if (this.state.selectedYear) {

            const from = new Date(this.state.selectedYear, quarter * 3).getTime();
            const to = new Date(this.state.selectedYear + Math.floor(quarter / 4), (quarter + 1) * 3 % 4).getTime();

            this.props.expirySelected({
                from: from,
                to: to,
                label: `${this.quartersTranslator[quarter]} ${this.state.selectedYear.toString()}`
            });
        }
    }

    /**
     * Called when a month button is pressed
     * Sets current tray expiry to that month in selectedYear
     * @param month - number in [0-11] inclusive representing the current month
     */
    private selectMonth(month: number): void {
        if (this.state.selectedYear) {

            const from = new Date(this.state.selectedYear, month).getTime();
            const to = new Date(month === 11 ? this.state.selectedYear + 1
                                             : this.state.selectedYear, (month + 1) % 12).getTime();

            this.props.expirySelected({
                from: from,
                to: to,
                label: `${this.monthsTranslator[month]} ${this.state.selectedYear.toString()}`
            });
        }
    }

    /**
     * Return different keyboards depending on keyboardState
     * @param disabled whether the keyboard is disabled (ie no trays are selected)
     */
    private chooseKeyboard(disabled: boolean): React.ReactNode {
        // We are passed all of the selected TrayCells, only want to consider the actual Trays (not TraySpaces)
        const traysOnly: Tray[] = this.props.selectedTrayCells.filter((a): a is Tray => a instanceof Tray);

        if (this.props.keyboardState === "category") {

            const firstCat = traysOnly.find(i => i !== undefined)?.category?.name;
            const commonCat = firstCat === undefined ? undefined
                                                     : traysOnly.every(item => item.category?.name === undefined || item.category.name === firstCat)
                                                       ? firstCat : null;

            const buttons: KeyboardButtonProps[] = this.props.categories.map((cat) => {
                return {
                    name: cat.shortName ?? cat.name,
                    onClick: () => this.props.categorySelected(cat),
                    selected: cat.name === commonCat
                };
            }).concat([
                {
                    name: "Clear",
                    onClick: () => this.props.categorySelected(null),
                    selected: false
                }
            ]);
            return <Keyboard id="cat-keyboard" disabled={disabled} buttons={buttons} gridX={8}/>;

        } else if (this.props.keyboardState === "expiry") {

            const firstExp = traysOnly.find(i => i.expiry !== undefined)?.expiry?.from;
            const firstYear = firstExp ? new Date(firstExp).getFullYear() : undefined;

            const commonYear = firstYear !== undefined && traysOnly.every(item =>
                item.expiry?.from && new Date(item.expiry.from).getFullYear() === firstYear
            ) ? firstYear : undefined;

            // update object-level selectedYear
            this.setState(state => ({
                ...state,
                selectedYear: commonYear
            }));

            // set the button corresponding to selectedYear to be visibly selected
            for (const year of this.years) {
                year.selected = year.name === commonYear?.toString();
            }

            const specialButtons = [
                {
                    name: "Indefinite",
                    onClick: () => this.props.expirySelected({
                        from: null,
                        to: null,
                        label: "Indefinite"
                    })

                }, {
                    name: "Clear",
                    onClick: () => this.props.expirySelected(null)

                }
            ];

            return <div className="keyboard-container">
                <Keyboard id="exp-special" disabled={disabled} buttons={specialButtons} gridX={1}/>
                <div className="vl"/>
                <Keyboard id="exp-years" disabled={disabled} buttons={this.years} gridX={2}/>
                <div className="vl"/>
                <Keyboard id="exp-quarters" disabled={!commonYear} buttons={this.quarters} gridX={1}/>
                <Keyboard id="exp-months" disabled={!commonYear} buttons={this.months} gridX={3}/>
            </div>;

        } else if (this.props.keyboardState === "weight") {

            // Create numpad for the digits and decimal point buttons
            const numpad = (Array(9).fill(0).map((_, i) => i + 1) as WeightKeyboardButton[])
                .concat([0, "."])
                .map((a) => ({
                    name: a.toString(),
                    onClick: () => this.weightKeyHandler(a),
                    disabled: this.props.selectedTrayCells.length === 0,
                }));

            // Create numpadSide for the side buttons
            const numpadSide = (["Backspace", "Clear"].concat(this.props.user.willAutoAdvance ? ["Next"]
                                                                                              : []) as WeightKeyboardButton[])
                .map((a) => ({
                    name: a.toString(),
                    icon: a === "Backspace" ? faBackspace : undefined,
                    disabled: this.props.selectedTrayCells.length === 0,
                    onClick: () => this.weightKeyHandler(a)
                }));

            return <div className="keyboard-container">
                <Keyboard id="weight-numpad" buttons={numpad} gridX={3}/>
                <div id="numpadR">
                    <div id="draftWeight">
                        {`${this.props.weight === undefined ? "?" : this.props.weight} kg`}
                    </div>
                    <div id="weight-numpad-side">
                        <Keyboard buttons={numpadSide} gridX={1}/>
                    </div>
                </div>
            </div>;

        } else { // edit shelf
            return <div>
                Unimplemented Panel
            </div>;
        }

    }

    /**
     * @inheritDoc
     */
    render(): React.ReactNode {

        console.log("render > ", this.props.weight);
        // return DOM elements using button structures
        return <div id="bottom">
            {this.chooseKeyboard(!this.props.selectedTrayCells.length)}
        </div>;
    }
}
