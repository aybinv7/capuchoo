export declare class MultiStepProgress {
    private multibar;
    private progressBar;
    private spinner;
    private totalSteps;
    private currentStep;
    constructor();
    start(totalSteps: number, initialMessage: string): void;
    nextStep(message: string): void;
    updateMessage(message: string): void;
    finish(message: string): void;
    fail(message: string): void;
}
