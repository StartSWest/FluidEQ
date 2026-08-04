Feature: Change number of frequency bands
  Users want to increase or decrease the number of frequency bands

  Scenario: Add a frequency band
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is enabled
      And there are 10 frequency bands
    When I click to add a frequency band
    Then FluidEQ config file should show 11 frequency bands

  Scenario: Remove a frequency band
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is enabled
      And there are 10 frequency bands
    When I click to remove a frequency band
    Then FluidEQ config file should show 9 frequency bands
