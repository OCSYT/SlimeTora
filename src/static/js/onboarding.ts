class Onboarding {
    private steps: HTMLElement[];
    private currentStepIndex: number;
    private config: typeof onboardingConfig;

    constructor(config: typeof onboardingConfig) {
        this.config = config;
        this.steps = config.steps.map((step) => {
            const element = document.getElementById(step.id) as HTMLElement;
            if (!element) {
                window.error(`Element with ID ${step.id} not found`);
            }
            return element;
        });
        this.currentStepIndex = 0;
        window.log(`Initial step index: ${this.currentStepIndex}`);
        this.showStep(this.currentStepIndex);
        this.addEventListeners();
    }

    private showStep(index: number): void {
        window.log(`Showing step index: ${index}`);
        this.steps.forEach((step, i) => {
            if (i === index) {
                window.log(`Displaying element with ID: ${step.id}`);
                step.style.display = "flex";
            } else {
                step.style.display = "none";
            }
        });
        // Ensure the current step is visible
        const currentStep = this.steps[index];
        if (currentStep && currentStep.style.display !== "flex") {
            window.log(`Step ${currentStep.id} is not visible, forcing display`);
            currentStep.style.display = "flex";
        }
    }

    private goToStep(stepId: string): void {
        const stepIndex = this.config.steps.findIndex((step) => step.id === stepId);
        if (stepIndex !== -1) {
            this.currentStepIndex = stepIndex;
            this.showStep(this.currentStepIndex);
        } else {
            window.error(`Step with ID ${stepId} not found`);
        }
    }

    private addEventListeners(): void {
        this.config.steps.forEach((step) => {
            Object.entries(step.buttons).forEach(([buttonId, targetStepId]) => {
                const button = document.getElementById(buttonId);
                if (button) {
                    button.addEventListener("click", () => {
                        window.log(`Button with ID ${buttonId} clicked`);
                        if (targetStepId === "finish") {
                            alert(`${step.id.includes("automatic") ? "Automatic" : "Manual"} setup finished!`);
                        } else {
                            this.goToStep(targetStepId);
                        }
                    });
                } else {
                    window.error(`Button with ID ${buttonId} not found`);
                }
            });
        });
    }
}

type Step = {
    id: string;
    next?: string;
    prev?: string;
    buttons: { [key: string]: string };
};

const createSteps = (path: string): Step[] => {
    return [
        {
            id: `step-1`,
            next: `step-2-${path}`,
            buttons: {
                [`${path}-setup-button`]: `step-2-${path}`,
                "manual-setup-button": "step-2-manual",
            },
        },
        {
            id: `step-2-${path}`,
            next: `step-3-${path}`,
            prev: "step-1",
            buttons: {
                [`next-${path}-button`]: `step-3-${path}`,
                [`back-${path}-button`]: "step-1",
            },
        },
        {
            id: `step-3-${path}`,
            prev: `step-2-${path}`,
            buttons: {
                [`finish-${path}-button`]: "finish",
                [`back-${path}-step2-button`]: `step-2-${path}`,
            },
        },
    ];
};

const onboardingConfig = {
    steps: [
        ...createSteps("automatic"),
        ...createSteps("manual"),
    ],
};

// Initialize the onboarding process
document.addEventListener("DOMContentLoaded", () => {
    new Onboarding(onboardingConfig);
});

export {};