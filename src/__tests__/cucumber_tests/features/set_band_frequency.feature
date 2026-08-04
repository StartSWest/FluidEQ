Feature: Set frequency for a band
  Users want to change the frequency that a band represents

  Scenario: Set a new frequency using the input field
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is enabled
    When I set the frequency of band 1 to 100Hz
    Then FluidEQ config file should show a frequency of 100Hz for band 1

  Scenario: Set a new frequency using the arrow buttons
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And the frequency of band 1 is 32Hz
      And FluidEQ equalizer state is enabled
    When I click on the up arrow of band 1 2 times
    Then FluidEQ config file should show a frequency of 34Hz for band 1
