import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthDto } from './auth-dto';
import * as argon from 'argon2';
// import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  /**Method to signup */
  async signup(dto: AuthDto) {
    console.log(dto);

    //generate the password hash
    const hash = await argon.hash(dto.password);

    //save the new user in the db
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, hash },
        //choose only what you want to return
        // select: {
        //   id: true,
        //   email: true,
        //   createdAt: true,
        // },
      });
      delete user.hash;

      //return the saved user
      return user;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ForbiddenException('Credentials taken');
        }
      }
      throw error;
    }
  }

  /**Method to login */
  async login(dto: AuthDto) {
    /**find user by email*/
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
      },
    });

    /**if user does not exist throw exception*/
    if (!user) {
      throw new ForbiddenException('Credentials incorrect');
    }

    /**compare passwords*/
    const pwMatches = await argon.verify(user.hash, dto.password);

    /**if password incorrect throw exception*/
    if (!pwMatches) {
      throw new ForbiddenException('Credentials incorrect');
    }

    /**return user*/
    return this.signToken(user.id, user.email);
  }

  /**Method to sign token */
  async signToken(
    userId: string,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };
    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '15m',
      secret: secret,
    });

    return {
      access_token: token,
    };
  }
}
