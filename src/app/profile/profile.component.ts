import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SupabaseService } from '../services/supabase.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export function strictEmailValidator(control: AbstractControl): ValidationErrors | null {
  const email = control.value;
  if (!email) return null;
  const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  return strictEmailRegex.test(email) ? null : { strictEmail: true };
}

declare const bootstrap: any;

interface CountryCode {
  value: string;
  label: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  profileForm: FormGroup;
  userId: string | null = null;
  successMessage: string = '';
  errorMessage: string = '';
  loading: boolean = false;
  years: number[] = []; 
  countries: string[] = [];

  // for custom select popup
countryCodes: CountryCode[] = [
  { value: '+93', label: 'AFG | +93' },
  { value: '+355', label: 'ALB | +355' },
  { value: '+213', label: 'DZA | +213' },
  { value: '+376', label: 'AND | +376' },
  { value: '+244', label: 'AGO | +244' },
  { value: '+1-268', label: 'ATG | +1-268' },
  { value: '+54', label: 'ARG | +54' },
  { value: '+374', label: 'ARM | +374' },
  { value: '+61', label: 'AUS | +61' },
  { value: '+43', label: 'AUT | +43' },
  { value: '+994', label: 'AZE | +994' },
  { value: '+1-242', label: 'BHS | +1-242' },
  { value: '+973', label: 'BHR | +973' },
  { value: '+880', label: 'BGD | +880' },
  { value: '+1-246', label: 'BRB | +1-246' },
  { value: '+375', label: 'BLR | +375' },
  { value: '+32', label: 'BEL | +32' },
  { value: '+501', label: 'BLZ | +501' },
  { value: '+229', label: 'BEN | +229' },
  { value: '+975', label: 'BTN | +975' },
  { value: '+591', label: 'BOL | +591' },
  { value: '+387', label: 'BIH | +387' },
  { value: '+267', label: 'BWA | +267' },
  { value: '+55', label: 'BRA | +55' },
  { value: '+673', label: 'BRN | +673' },
  { value: '+359', label: 'BGR | +359' },
  { value: '+226', label: 'BFA | +226' },
  { value: '+257', label: 'BDI | +257' },
  { value: '+855', label: 'KHM | +855' },
  { value: '+237', label: 'CMR | +237' },
  { value: '+1', label: 'CAN | +1' },
  { value: '+238', label: 'CPV | +238' },
  { value: '+236', label: 'CAF | +236' },
  { value: '+235', label: 'TCD | +235' },
  { value: '+56', label: 'CHL | +56' },
  { value: '+86', label: 'CHN | +86' },
  { value: '+57', label: 'COL | +57' },
  { value: '+269', label: 'COM | +269' },
  { value: '+242', label: 'COG | +242' },
  { value: '+243', label: 'COD | +243' },
  { value: '+506', label: 'CRI | +506' },
  { value: '+225', label: 'CIV | +225' },
  { value: '+385', label: 'HRV | +385' },
  { value: '+53', label: 'CUB | +53' },
  { value: '+357', label: 'CYP | +357' },
  { value: '+420', label: 'CZE | +420' },
  { value: '+45', label: 'DNK | +45' },
  { value: '+253', label: 'DJI | +253' },
  { value: '+1-767', label: 'DMA | +1-767' },
  { value: '+1-809', label: 'DOM | +1-809' },
  { value: '+593', label: 'ECU | +593' },
  { value: '+20', label: 'EGY | +20' },
  { value: '+503', label: 'SLV | +503' },
  { value: '+240', label: 'GNQ | +240' },
  { value: '+291', label: 'ERI | +291' },
  { value: '+372', label: 'EST | +372' },
  { value: '+251', label: 'ETH | +251' },
  { value: '+679', label: 'FJI | +679' },
  { value: '+358', label: 'FIN | +358' },
  { value: '+33', label: 'FRA | +33' },
  { value: '+241', label: 'GAB | +241' },
  { value: '+220', label: 'GMB | +220' },
  { value: '+995', label: 'GEO | +995' },
  { value: '+49', label: 'DEU | +49' },
  { value: '+233', label: 'GHA | +233' },
  { value: '+30', label: 'GRC | +30' },
  { value: '+1-473', label: 'GRD | +1-473' },
  { value: '+502', label: 'GTM | +502' },
  { value: '+224', label: 'GIN | +224' },
  { value: '+245', label: 'GNB | +245' },
  { value: '+592', label: 'GUY | +592' },
  { value: '+509', label: 'HTI | +509' },
  { value: '+504', label: 'HND | +504' },
  { value: '+36', label: 'HUN | +36' },
  { value: '+354', label: 'ISL | +354' },
  { value: '+91', label: 'IND | +91' },
  { value: '+62', label: 'IDN | +62' },
  { value: '+98', label: 'IRN | +98' },
  { value: '+964', label: 'IRQ | +964' },
  { value: '+353', label: 'IRL | +353' },
  { value: '+972', label: 'ISR | +972' },
  { value: '+39', label: 'ITA | +39' },
  { value: '+1-876', label: 'JAM | +1-876' },
  { value: '+81', label: 'JPN | +81' },
  { value: '+962', label: 'JOR | +962' },
  { value: '+7', label: 'KAZ | +7' },
  { value: '+254', label: 'KEN | +254' },
  { value: '+686', label: 'KIR | +686' },
  { value: '+850', label: 'PRK | +850' },
  { value: '+82', label: 'KOR | +82' },
  { value: '+965', label: 'KWT | +965' },
  { value: '+996', label: 'KGZ | +996' },
  { value: '+856', label: 'LAO | +856' },
  { value: '+371', label: 'LVA | +371' },
  { value: '+961', label: 'LBN | +961' },
  { value: '+266', label: 'LSO | +266' },
  { value: '+231', label: 'LBR | +231' },
  { value: '+218', label: 'LBY | +218' },
  { value: '+423', label: 'LIE | +423' },
  { value: '+370', label: 'LTU | +370' },
  { value: '+352', label: 'LUX | +352' },
  { value: '+389', label: 'MKD | +389' },
  { value: '+261', label: 'MDG | +261' },
  { value: '+265', label: 'MWI | +265' },
  { value: '+60', label: 'MYS | +60' },
  { value: '+960', label: 'MDV | +960' },
  { value: '+223', label: 'MLI | +223' },
  { value: '+356', label: 'MLT | +356' },
  { value: '+692', label: 'MHL | +692' },
  { value: '+222', label: 'MRT | +222' },
  { value: '+230', label: 'MUS | +230' },
  { value: '+52', label: 'MEX | +52' },
  { value: '+691', label: 'FSM | +691' },
  { value: '+373', label: 'MDA | +373' },
  { value: '+377', label: 'MCO | +377' },
  { value: '+976', label: 'MNG | +976' },
  { value: '+382', label: 'MNE | +382' },
  { value: '+212', label: 'MAR | +212' },
  { value: '+258', label: 'MOZ | +258' },
  { value: '+95', label: 'MMR | +95' },
  { value: '+264', label: 'NAM | +264' },
  { value: '+674', label: 'NRU | +674' },
  { value: '+977', label: 'NPL | +977' },
  { value: '+31', label: 'NLD | +31' },
  { value: '+64', label: 'NZL | +64' },
  { value: '+505', label: 'NIC | +505' },
  { value: '+227', label: 'NER | +227' },
  { value: '+234', label: 'NGA | +234' },
  { value: '+47', label: 'NOR | +47' },
  { value: '+968', label: 'OMN | +968' },
  { value: '+92', label: 'PAK | +92' },
  { value: '+680', label: 'PLW | +680' },
  { value: '+970', label: 'PSE | +970' },
  { value: '+507', label: 'PAN | +507' },
  { value: '+675', label: 'PNG | +675' },
  { value: '+595', label: 'PRY | +595' },
  { value: '+51', label: 'PER | +51' },
  { value: '+63', label: 'PHL | +63' },
  { value: '+48', label: 'POL | +48' },
  { value: '+351', label: 'PRT | +351' },
  { value: '+974', label: 'QAT | +974' },
  { value: '+40', label: 'ROU | +40' },
  { value: '+7', label: 'RUS | +7' },
  { value: '+250', label: 'RWA | +250' },
  { value: '+685', label: 'WSM | +685' },
  { value: '+378', label: 'SMR | +378' },
  { value: '+239', label: 'STP | +239' },
  { value: '+966', label: 'SAU | +966' },
  { value: '+221', label: 'SEN | +221' },
  { value: '+381', label: 'SRB | +381' },
  { value: '+248', label: 'SYC | +248' },
  { value: '+232', label: 'SLE | +232' },
  { value: '+65', label: 'SGP | +65' },
  { value: '+421', label: 'SVK | +421' },
  { value: '+386', label: 'SVN | +386' },
  { value: '+677', label: 'SLB | +677' },
  { value: '+252', label: 'SOM | +252' },
  { value: '+27', label: 'ZAF | +27' },
  { value: '+211', label: 'SSD | +211' },
  { value: '+34', label: 'ESP | +34' },
  { value: '+94', label: 'LKA | +94' },
  { value: '+249', label: 'SDN | +249' },
  { value: '+597', label: 'SUR | +597' },
  { value: '+268', label: 'SWZ | +268' },
  { value: '+46', label: 'SWE | +46' },
  { value: '+41', label: 'CHE | +41' },
  { value: '+963', label: 'SYR | +963' },
  { value: '+886', label: 'TWN | +886' },
  { value: '+992', label: 'TJK | +992' },
  { value: '+255', label: 'TZA | +255' },
  { value: '+66', label: 'THA | +66' },
  { value: '+228', label: 'TGO | +228' },
  { value: '+676', label: 'TON | +676' },
  { value: '+1-868', label: 'TTO | +1-868' },
  { value: '+216', label: 'TUN | +216' },
  { value: '+90', label: 'TUR | +90' },
  { value: '+993', label: 'TKM | +993' },
  { value: '+688', label: 'TUV | +688' },
  { value: '+256', label: 'UGA | +256' },
  { value: '+380', label: 'UKR | +380' },
  { value: '+971', label: 'ARE | +971' },
  { value: '+44', label: 'GBR | +44' },
  { value: '+1', label: 'USA | +1' },
  { value: '+598', label: 'URY | +598' },
  { value: '+998', label: 'UZB | +998' },
  { value: '+678', label: 'VUT | +678' },
  { value: '+379', label: 'VAT | +379' },
  { value: '+58', label: 'VEN | +58' },
  { value: '+84', label: 'VNM | +84' },
  { value: '+967', label: 'YEM | +967' },
  { value: '+260', label: 'ZMB | +260' },
  { value: '+263', label: 'ZWE | +263' }
];

  showCodePopup = false;
  searchTerm = '';

  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  constructor() {
    this.profileForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: [{ value: '', disabled: true }],
      phone_country_code: ['',  Validators.required],
      phone_number: ['',  Validators.required],
      month_of_birth: [''],
      year_of_birth: [''],
      nationality: [''],
      country_of_residance: ['',  Validators.required],
      gender: [''],
      instagram_url: ['']
    });
  }

  async ngOnInit() {
    this.generateYearOptions(); //  years dropdown
    this.populateCountries(); // countries dropdown

    this.userId = this.authService.getUserId();
    if (!this.userId) return;

    const brandUser = await this.supabaseService.getBrandUser(this.userId);

    if (brandUser && brandUser.length > 0) {
      this.authService.setProfileComplete(true);
      this.router.navigate(['/dashboard']);
      return;
    }

    this.getProfile(this.userId);
  }

  //  years dropdown
  private generateYearOptions(): void {
    const currentYear = new Date().getFullYear();
    const startYear = 1900;
    for (let year = currentYear; year >= startYear; year--) {
      this.years.push(year);
    }
  }

  // countries dropdown
  private populateCountries(): void {
     this.countries = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola',
    'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
    'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus',
    'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
    'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria',
    'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
    'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
    'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
    'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Eswatini',
    'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon',
    'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
    'Greenland', 'Grenada', 'Guatemala', 'Guinea', 'Guyana',
    'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India',
    'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
    'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan',
    'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos',
    'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
    'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi',
    'Malaysia', 'Maldives', 'Mali', 'Malta', 'Mauritania',
    'Mauritius', 'Mexico', 'Moldova', 'Monaco', 'Mongolia',
    'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
    'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
    'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
    'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
    'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
    'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda',
    'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent', 'Samoa', 'San Marino',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone',
    'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa',
    'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
    'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
    'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo',
    'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan',
    'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
    'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
    'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
  ];
  }


  getProfile(userId: string) {
    this.loading = true;
    this.errorMessage = '';

    this.supabaseService.getProfile(userId)
      .then(profile => {
        if (profile) {
          this.profileForm.patchValue({
            ...profile,
             email: profile.email || '',
            year_of_birth: profile.year_of_birth || '',
            month_of_birth: profile.month_of_birth || '',
            nationality: profile.nationality || '',
            country_of_residance: profile.country_of_residance || '',
            gender: profile.gender || ''
          });

          const isComplete = !!profile.first_name?.trim();
          this.authService.setProfileComplete(isComplete);
        }
      })
      .catch(error => {
        this.errorMessage = 'Failed to fetch profile.';
        console.error(error);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  async saveProfile() {
    if (this.profileForm.invalid) {
      this.errorMessage = 'Please fill in the required fields.';
      return;
    }

    if (!this.userId) {
      this.errorMessage = 'User ID not found.';
      return;
    }

    this.errorMessage = '';
    const updatedFields = { ...this.profileForm.getRawValue() };

    if (updatedFields.phone_country_code && !updatedFields.phone_country_code.startsWith('+')) {
      updatedFields.phone_country_code = '+' + updatedFields.phone_country_code;
    }

    try {
      const error = await this.supabaseService.updateProfile(this.userId, updatedFields);

      if (!error) {
        this.successMessage = 'Profile updated successfully!';
        const isComplete = !!updatedFields.first_name?.trim();
        this.authService.setProfileComplete(isComplete);

        if (isComplete) {
          const modalElement = document.getElementById('profileUpdatedModal');
          if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
          }
        }
      }
    } catch (error) {
      this.errorMessage = 'An error occurred while updating the profile.';
      console.error(error);
    }
  }

  public onModalOk(): void {
    this.router.navigate(['/dashboard']);
  }

  // ===== Custom select methods =====
  openCodePopup() {
    this.showCodePopup = true;
    this.searchTerm = '';
  }

  closeCodePopup() {
    this.showCodePopup = false;
  }

  selectCode(option: CountryCode) {
    this.profileForm.get('phone_country_code')?.setValue(option.value);
    this.closeCodePopup();
  }

  // get filteredCodes(): CountryCode[] {
  //   return this.countryCodes.filter(o =>
  //     o.label.toLowerCase().includes(this.searchTerm.toLowerCase())
  //   );
  // }

  get selectedCodeLabel(): string {
    const val = this.profileForm.get('phone_country_code')?.value;
    const opt = this.countryCodes.find(o => o.value === val);
    return opt ? opt.label : 'Country Code *';
  }

  sortMode: 'alphabetical' | 'numerical' = 'alphabetical';

setSortMode(mode: 'alphabetical' | 'numerical') {
  this.sortMode = mode;
}
  
get filteredCodes(): CountryCode[] {
  let results = this.countryCodes.filter(o =>
    o.label.toLowerCase().includes(this.searchTerm.toLowerCase())
  );

  if (this.sortMode === 'alphabetical') {
    results = results.sort((a, b) => a.label.localeCompare(b.label));
  } else {
    results = results.sort((a, b) => {
      const numA = parseInt(a.value.replace('+', ''), 10);
      const numB = parseInt(b.value.replace('+', ''), 10);
      return numA - numB;
    });
  }
  return results;
}

}
