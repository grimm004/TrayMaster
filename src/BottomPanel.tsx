import React from "react";
import {Keyboard, KeyboardButtonProps} from "./keyboard";
import {KeyboardName} from "./ShelfView";
import {ExpiryRange, Tray} from "./core/MockWarehouse";
import {faBackspace} from "@fortawesome/free-solid-svg-icons";

export interface BottomPanelProps {
    keyboardState: KeyboardName;
    expirySelected: (expiry: ExpiryRange) => void;
    categories: KeyboardButtonProps[];
    selectedTrays: Tray[];
    draftWeight?: string;
    setDraftWeight: (newDraftWeight?: string) => void;
    applyDraftWeight: () => void;
}

/**
 * This class represents the enter bottom panel component.  This component manages the various BottomPanelPages.
 * @see BottomPanelPage
 */
export class BottomPanel extends React.Component<BottomPanelProps> {
    years: KeyboardButtonProps[];
    quarters: KeyboardButtonProps[];
    months: KeyboardButtonProps[];
    quartersTranslator: string[] = [
        "Jan-Mar",
        "Apr-Jun",
        "Jul-Sep",
        "Oct-Dec"
    ];
    monthsTranslator: string[] = [
        "Jan", "Feb", "Mar",
        "Apr", "May", "Jun",
        "Jul", "Aug", "Sep",
        "Oct", "Nov", "Dec"
    ];

    /**
     * Currently selected year
     */
    selectedYear: number | null = null;

    constructor(props: BottomPanelProps) {
        super(props);

        // Expiry keyboard structure
        this.years = [];
        for (let i = 2019; i < 2027; i++) {
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
    weightKeyHandler(key: "Enter" | "Clear" | "Backspace" | number | ".") {

        if (key === "Enter") {
            this.props.applyDraftWeight();
        } else {
            let newDraftWeight: string | undefined;
            if (key === "Clear") {
                newDraftWeight = "";
            } else if (key === "Backspace") {
                newDraftWeight = this.props.draftWeight?.slice(0, -1);
            } else {
                // Must be a number or decimal point, just append
                // Unless it's only a zero, in which case we don't want a leading zero so just replace it. This deals
                // with overwriting the default 0 value too
                if (this.props.draftWeight === "0" && key !== ".") {
                    newDraftWeight = `${key}`;
                } else {
                    newDraftWeight = `${this.props.draftWeight ?? ""}${key}`;
                }
            }

            if (newDraftWeight === "") {
                this.props.setDraftWeight(undefined);
            } else if (!isNaN(Number(newDraftWeight)) && (newDraftWeight ?? "").length <= 6) {
                this.props.setDraftWeight(newDraftWeight);
            }
        }
    }

    /**
     * Called when a year button is pressed
     * Sets selectedYear and current tray expiry to that year
     * @param year - number representing the current year
     */
    selectYear(year: number) {
        this.selectedYear = year;
        this.props.expirySelected({
            from: new Date(year, 0).getTime(),
            to: new Date(year + 1, 0).getTime(),
            label: year.toString()
        });
    }

    /**
     * Called when a quarter button is pressed
     * Sets current tray expiry to that quarter in selectedYear
     * @param quarter - number in [0-3] inclusive representing the current quarter
     */
    selectQuarter(quarter: number) {
        if (this.selectedYear) {
            this.props.expirySelected({
                from: new Date(this.selectedYear, quarter * 3).getTime(),
                to: new Date(quarter === 3 ? this.selectedYear + 1
                                           : this.selectedYear, (quarter + 1) * 3 % 4).getTime(),
                label: `${this.quartersTranslator[quarter]} ${this.selectedYear.toString()}`
            });
        }
    }

    /**
     * Called when a month button is pressed
     * Sets current tray expiry to that month in selectedYear
     * @param month - number in [0-11] inclusive representing the current quarter
     */
    selectMonth(month: number) {
        if (this.selectedYear) {
            this.props.expirySelected({
                from: new Date(this.selectedYear, month).getTime(),
                to: new Date(month === 11 ? this.selectedYear + 1 : this.selectedYear, (month + 1) % 12).getTime(),
                label: `${this.monthsTranslator[month]} ${this.selectedYear.toString()}`
            });
        }
    }

    /**
     * Return different keyboards depending on keyboardState
     * @param disabled whether the keyboard is disabled (ie no trays are selected)
     * @param currentTray the current tray, if there's only one tray
     */
    chooseKeyboard(disabled: boolean, currentTray?: Tray) {
        if (this.props.keyboardState === "category") {

            let commonCat: string | null = "";
            for (let i of this.props.selectedTrays) {
                let currentCat = i.category?.shortName || i.category?.name;
                if (commonCat === "" && currentCat) {
                    commonCat = currentCat;
                }
                if (commonCat && currentCat && commonCat !== currentCat) {
                    commonCat = null;
                    break;
                }
            }

            let categoryButtons: KeyboardButtonProps[] = this.props.categories;
            for (let i = 0; i < categoryButtons.length; i++) {
                categoryButtons[i].selected = categoryButtons[i].name === commonCat;
            }
            return <Keyboard id="cat-keyboard" disabled={disabled} buttons={this.props.categories} gridX={8}/>;

        } else if (this.props.keyboardState === "expiry") {

            let commonYear: number | null = 0;
            for (let i of this.props.selectedTrays) {
                let currentExpiry = i.expiry?.from ? new Date(i.expiry.from).getFullYear() : undefined;
                if (commonYear === 0 && currentExpiry) {
                    commonYear = currentExpiry;
                }
                if (commonYear && currentExpiry && commonYear !== currentExpiry) {
                    commonYear = null;
                    break;
                }
            }

            // update selectedYear: don't need to worry about disabled as currentTray will be undefined if disabled
            this.selectedYear = commonYear;

            // set the button corresponding to selectedYear to be visibly selected
            for (let i = 0; i < this.years.length; i++) {
                this.years[i].selected = this.years[i].name === commonYear?.toString();
            }

            return <div className="keyboard-container">
                <Keyboard id="exp-1" disabled={disabled} buttons={this.years} gridX={2}/>
                <div className="vl"/>
                <Keyboard id="exp-2" disabled={!commonYear} buttons={this.quarters} gridX={1}/>
                <Keyboard id="exp-3" disabled={!commonYear} buttons={this.months} gridX={3}/>
            </div>;

        } else { // (this.props.keyboardState === "weight")

            // Weight numpad structure
            let numpad = [];
            for (let i = 9; i >= 0; i--) {
                numpad.push({
                    name: i.toString(), onClick: () => {
                        this.weightKeyHandler(i);
                    }
                });
            }
            numpad.push({
                name: ".", onClick: () => {
                    this.weightKeyHandler(".");
                }
            });

            let numpadR = [
                {
                    name: "Backspace",
                    icon: faBackspace,
                    disabled: (this.props.draftWeight ?? "").length === 0,
                    onClick: () => {
                        this.weightKeyHandler("Backspace");
                    }
                },
                {
                    name: "Clear",
                    disabled: (this.props.draftWeight ?? "").length === 0,
                    onClick: () => {
                        this.weightKeyHandler("Clear");
                    }
                },
                {
                    name: "Enter",
                    disabled: this.props.selectedTrays.length === 0,
                    onClick: () => {
                        this.weightKeyHandler("Enter");
                    }
                }
            ];

            return <div className="keyboard-container">
                <Keyboard id="weight-numpad" buttons={numpad} gridX={3}/>
                <div id="numpadR">
                    <div id="draftWeight">
                        {`${this.props.draftWeight === undefined ? "?" : this.props.draftWeight} kg`}
                    </div>
                    <div id="weight-numpad-side">
                        <Keyboard buttons={numpadR} gridX={1}/>
                    </div>
                </div>
            </div>;

        }
    }

    /**
     * @inheritDoc
     */
    render() {
        const currentTray: Tray | undefined = this.props.selectedTrays.length === 1 ? this.props.selectedTrays[0]
                                                                                    : undefined;
        const disabled: boolean = !this.props.selectedTrays.length;

        // return DOM elements using button structures
        return <div id="bottom">
            {this.chooseKeyboard(disabled, currentTray)}
        </div>;
    }
}
