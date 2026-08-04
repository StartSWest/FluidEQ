Feature: Set whether the equalizer is enabled or disabled
  Users want to toggle whether the equalizer is enabled or disabled

  Scenario: Enable the equalizer
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is disabled
    When I toggle the equalizer state
    Then FluidEQ config file should be non-empty
  
  Scenario: Disable the equalizer
    Given EqualizerAPO is installed
      And FluidEQ can write to its config
      And FluidEQ is running
      And FluidEQ equalizer state is enabled
    When I toggle the equalizer state
    Then FluidEQ config file should be empty
