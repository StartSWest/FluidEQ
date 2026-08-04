Feature: Set preamplification gain
  Users want to change the preamplification gain

  Scenario: Set preamp gain using the slider
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is enabled
    When I set gain of the preamp slider to the bottom
    Then FluidEQ config should show a preamp gain of -20dB
  
  Scenario: Set preamp gain using the arrows
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And the preamp gain is 0dB
      And FluidEQ equalizer state is enabled
    When I click on the up arrow for the preamp gain 3 times
    Then FluidEQ config should show a preamp gain of 3dB
